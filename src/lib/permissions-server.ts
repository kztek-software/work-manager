import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PRESETS,
  GLOBAL_ROLE_ONLY_PERMISSIONS,
  isSystemLevelPermission,
} from "@/lib/permissions";

// ---------------------------------------------------------------------------
// In-memory cache cho RoleDefinition permissions.
// Role definitions thay đổi rất ít (chỉ khi admin sửa) nên cache 5 phút là hợp lý.
// Mỗi lần ensureDefaultRoles() chạy (app start / admin update) cache sẽ bị xóa.
// ---------------------------------------------------------------------------
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

interface RoleCacheEntry {
  permissions: string[];
  expiresAt: number;
}

const rolePermissionsCache = new Map<string, RoleCacheEntry>();

/** Xóa toàn bộ cache (gọi sau khi admin cập nhật role) */
export function invalidateRolePermissionsCache() {
  rolePermissionsCache.clear();
}

// ensureDefaultRoles() trước đây chạy lại TOÀN BỘ 7 preset (tuần tự, không
// Promise.all) trên MỖI lần gọi GET /api/roles — đo thực tế gây ~1.5-2.5s
// dù đã "ấm", vì đây là bước sync 1 lần lúc khởi động/deploy, không cần chạy
// lại mỗi request. Thêm guard theo thời gian sống của process: chỉ thực sự
// chạy lại sau mỗi 5 phút (đủ để bắt kịp thay đổi DEFAULT_ROLE_PRESETS trong
// code sau khi deploy, nhưng không tốn round-trip DB ở từng request).
const ENSURE_ROLES_TTL_MS = 5 * 60 * 1000;
let defaultRolesEnsuredAt = 0;

// Khởi tạo bảng RoleDefinition trong Database & đồng bộ quyền mặc định
export async function ensureDefaultRoles() {
  const now = Date.now();
  if (now - defaultRolesEnsuredAt < ENSURE_ROLES_TTL_MS) {
    return;
  }
  defaultRolesEnsuredAt = now;

  // Xóa cache trước khi sync để các role mới nhất được load lại
  invalidateRolePermissionsCache();

  await Promise.all(
    DEFAULT_ROLE_PRESETS.map(async (preset) => {
      const existing = await prisma.roleDefinition.findUnique({
        where: { key: preset.key },
      });

      if (!existing) {
        await prisma.roleDefinition.create({
          data: {
            key: preset.key,
            name: preset.name,
            description: preset.description,
            color: preset.color,
            isSystem: preset.isSystem,
            permissions: JSON.stringify(preset.permissions),
          },
        });
      } else if (preset.isSystem && (preset.key === "ADMIN" || preset.key === "OWNER")) {
        // Luôn đồng bộ danh sách quyền mới nhất cho ADMIN và OWNER
        await prisma.roleDefinition.update({
          where: { key: preset.key },
          data: {
            permissions: JSON.stringify(preset.permissions),
          },
        });
      }
    })
  );
}

// Lấy danh sách quyền của một Role từ Database (có cache in-memory)
export async function getRolePermissions(roleKey: string): Promise<string[]> {
  const normKey = (roleKey || "MEMBER").toUpperCase();
  if (normKey === "ADMIN") return ALL_PERMISSION_KEYS;

  // Kiểm tra cache trước
  const cached = rolePermissionsCache.get(normKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const roleDef = await prisma.roleDefinition.findUnique({
    where: { key: normKey },
  });

  let permissions: string[];
  if (roleDef) {
    try {
      permissions = JSON.parse(roleDef.permissions) as string[];
    } catch {
      const preset = DEFAULT_ROLE_PRESETS.find((p) => p.key === normKey);
      permissions = preset ? preset.permissions : DEFAULT_ROLE_PRESETS.find((p) => p.key === "MEMBER")!.permissions;
    }
  } else {
    const preset = DEFAULT_ROLE_PRESETS.find((p) => p.key === normKey);
    permissions = preset ? preset.permissions : DEFAULT_ROLE_PRESETS.find((p) => p.key === "MEMBER")!.permissions;
  }

  // Ghi vào cache
  rolePermissionsCache.set(normKey, { permissions, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  return permissions;
}

// Kiểm tra quyền (Check Permission theo RoleKey)
export async function hasPermission(
  roleKey: string | undefined | null,
  requiredPermission: string
): Promise<boolean> {
  const normRole = (roleKey || "").toUpperCase();
  if (normRole === "ADMIN") return true;

  const permissions = await getRolePermissions(normRole);
  return permissions.includes(requiredPermission);
}

export type PermissionCheckResult = {
  allowed: boolean;
  role: string;
  projectRole: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  permissions: string[];
  reason?: string;
};

// Kiểm tra quyền toàn diện của User (kết hợp cấp Hệ thống & cấp Dự án).
// knownUserRole: nếu caller đã có user.role (từ requireUser / getSessionUser)
//   thì truyền vào để tránh query DB lần nữa.
export async function checkUserPermission(
  userId: string,
  requiredPermission: string,
  projectId?: string | null,
  knownUserRole?: string
): Promise<PermissionCheckResult> {
  let userRole: string | undefined;

  if (knownUserRole !== undefined) {
    userRole = knownUserRole;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      return {
        allowed: false,
        role: "VIEWER",
        projectRole: null,
        isAdmin: false,
        isOwner: false,
        permissions: [],
        reason: "Người dùng không tồn tại",
      };
    }
    userRole = user.role;
  }

  const isGlobalAdmin = (userRole || "").toUpperCase() === "ADMIN";
  if (isGlobalAdmin) {
    return {
      allowed: true,
      role: "ADMIN",
      projectRole: "ADMIN",
      isAdmin: true,
      isOwner: true,
      permissions: ALL_PERMISSION_KEYS,
    };
  }

  let projectRole: string | null = null;
  let isProjectOwner = false;

  if (projectId) {
    const [project, member] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      }),
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      }),
    ]);

    if (project && project.ownerId === userId) {
      isProjectOwner = true;
      projectRole = "OWNER";
    } else if (member) {
      projectRole = member.role;
      if (member.role?.toUpperCase() === "OWNER") {
        isProjectOwner = true;
      }
    }
  }

  // Nếu là Chủ dự án (Owner) thì có toàn quyền trong dự án (trừ system.* và users.manage)
  if (isProjectOwner) {
    const isSystemPerm = isSystemLevelPermission(requiredPermission);

    if (!isSystemPerm) {
      const ownerPerms = ALL_PERMISSION_KEYS.filter((k) => !isSystemLevelPermission(k));
      return {
        allowed: true,
        role: userRole || "MEMBER",
        projectRole: "OWNER",
        isAdmin: false,
        isOwner: true,
        permissions: ownerPerms,
      };
    }
  }

  // Tổng hợp quyền từ vai trò hệ thống và vai trò trong dự án
  const [globalPerms, projectPerms] = await Promise.all([
    getRolePermissions(userRole || "MEMBER"),
    projectRole ? getRolePermissions(projectRole) : Promise.resolve([]),
  ]);

  // Quyền chỉ xét theo vai trò hệ thống (vd: tickets.assign) không được cấp qua vai trò trong dự án
  const combinedPerms = Array.from(
    new Set([...globalPerms, ...projectPerms.filter((k) => !GLOBAL_ROLE_ONLY_PERMISSIONS.includes(k))])
  );
  const allowed = combinedPerms.includes(requiredPermission);

  return {
    allowed,
    role: userRole || "MEMBER",
    projectRole,
    isAdmin: false,
    isOwner: isProjectOwner,
    permissions: combinedPerms,
    reason: allowed
      ? undefined
      : `Bạn không có quyền thực hiện thao tác này (Yêu cầu quyền: ${requiredPermission})`,
  };
}

// Lấy toàn bộ Context Phân Quyền của User hiện tại.
// knownUserRole: nếu caller đã có user.role thì truyền vào để tránh query DB lần nữa.
export async function getUserPermissionContext(
  userId: string,
  projectId?: string | null,
  knownUserRole?: string
): Promise<{
  role: string;
  projectRole: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  canCreateProject: boolean;
  permissions: string[];
}> {
  let userRole: string | undefined;

  if (knownUserRole !== undefined) {
    userRole = knownUserRole;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      return {
        role: "VIEWER",
        projectRole: null,
        isAdmin: false,
        isOwner: false,
        canCreateProject: false,
        permissions: [],
      };
    }
    userRole = user.role;
  }

  const isAdmin = (userRole || "").toUpperCase() === "ADMIN";
  if (isAdmin) {
    return {
      role: "ADMIN",
      projectRole: "ADMIN",
      isAdmin: true,
      isOwner: true,
      canCreateProject: true,
      permissions: ALL_PERMISSION_KEYS,
    };
  }

  let projectRole: string | null = null;
  let isOwner = false;

  if (projectId) {
    const [project, member] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      }),
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      }),
    ]);

    if (project && project.ownerId === userId) {
      isOwner = true;
      projectRole = "OWNER";
    } else if (member) {
      projectRole = member.role;
      if (member.role?.toUpperCase() === "OWNER") {
        isOwner = true;
      }
    }
  }

  const [globalPerms, projectPerms] = await Promise.all([
    getRolePermissions(userRole || "MEMBER"),
    projectRole ? getRolePermissions(projectRole) : Promise.resolve([]),
  ]);

  let combinedPerms = Array.from(
    new Set([...globalPerms, ...projectPerms.filter((k) => !GLOBAL_ROLE_ONLY_PERMISSIONS.includes(k))])
  );
  if (isOwner) {
    const ownerPerms = ALL_PERMISSION_KEYS.filter((k) => !isSystemLevelPermission(k));
    combinedPerms = Array.from(new Set([...combinedPerms, ...ownerPerms]));
  }

  const canCreateProject =
    isAdmin ||
    isOwner ||
    (userRole || "").toUpperCase() === "OWNER" ||
    combinedPerms.includes("projects.create");

  return {
    role: userRole || "MEMBER",
    projectRole,
    isAdmin,
    isOwner,
    canCreateProject,
    permissions: combinedPerms,
  };
}
