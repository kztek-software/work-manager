import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import {
  ALL_PERMISSION_KEYS,
  GLOBAL_ROLE_ONLY_PERMISSIONS,
  isSystemLevelPermission,
} from "@/lib/permissions";
import { ensureDefaultRoles, getRolePermissions } from "@/lib/permissions-server";
import { sendNotification } from "@/lib/notifications";
import {
  checkTicketAction,
  isTicketFinal,
  type TicketActionName,
  type TicketActor,
  type TicketWorkflowState,
} from "@/lib/ticket-status";
import type { TicketCapabilitiesDto } from "@/lib/types";

// ---------------------------------------------------------------------------
// Phân quyền module Ticket Khách Hàng (/tickets, /api/tickets/**)
//
// - tickets.assign: CHỈ xét theo vai trò hệ thống (User.role). Người có quyền này xem TẤT CẢ
//   ticket (kể cả chưa gán dự án) và là người duy nhất được gán / đổi / bỏ gán dự án.
// - Còn lại: user chỉ xem ticket có projectId thuộc dự án họ là thành viên (hoặc chủ dự án)
//   VÀ có tickets.view trong dự án đó. Ticket chưa gán dự án bị ẩn hoàn toàn.
// - Quyền thao tác (reply/convert/delete...) trong 1 dự án = quyền vai trò hệ thống ∪ quyền vai trò
//   trong dự án (Owner dự án có toàn quyền trừ quyền cấp hệ thống) — giống checkUserPermission().
// ---------------------------------------------------------------------------

export type TicketProjectOption = { id: string; name: string; key: string };

export type TicketAccess = {
  userId: string;
  isAdmin: boolean;
  canAssign: boolean;
  globalPermissions: Set<string>;
  // Quyền đã gộp theo từng dự án user là thành viên / chủ dự án
  projectPermissions: Map<string, Set<string>>;
};

export async function getTicketAccess(user: SessionUser): Promise<TicketAccess> {
  // Bảo đảm preset ADMIN/OWNER trong DB đã có quyền mới nhất (vd: tickets.assign). Có guard TTL 5 phút.
  await ensureDefaultRoles();
  const isAdmin = (user.role || "").toUpperCase() === "ADMIN";
  const globalPermissions = new Set(
    isAdmin ? ALL_PERMISSION_KEYS : await getRolePermissions(user.role || "MEMBER")
  );
  const canAssign = isAdmin || globalPermissions.has("tickets.assign");

  const [memberships, ownedProjects] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true, role: true },
    }),
    prisma.project.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    }),
  ]);

  // Lấy quyền của từng vai trò dự án (getRolePermissions đã có cache in-memory)
  const roleKeys = Array.from(new Set(memberships.map((m) => (m.role || "MEMBER").toUpperCase())));
  const rolePermEntries = await Promise.all(
    roleKeys.map(async (r) => [r, await getRolePermissions(r)] as const)
  );
  const permsByRole = new Map(rolePermEntries);
  const ownerPerms = ALL_PERMISSION_KEYS.filter((k) => !isSystemLevelPermission(k));

  const projectPermissions = new Map<string, Set<string>>();
  for (const m of memberships) {
    const roleKey = (m.role || "MEMBER").toUpperCase();
    const perms = new Set(globalPermissions);
    for (const k of permsByRole.get(roleKey) || []) {
      if (!GLOBAL_ROLE_ONLY_PERMISSIONS.includes(k)) perms.add(k);
    }
    if (roleKey === "OWNER") ownerPerms.forEach((k) => perms.add(k));
    projectPermissions.set(m.projectId, perms);
  }
  for (const p of ownedProjects) {
    const perms = projectPermissions.get(p.id) || new Set(globalPermissions);
    ownerPerms.forEach((k) => perms.add(k));
    projectPermissions.set(p.id, perms);
  }

  return { userId: user.id, isAdmin, canAssign, globalPermissions, projectPermissions };
}

/** Danh sách id dự án mà user (không có tickets.assign) được xem ticket */
export function getViewableTicketProjectIds(access: TicketAccess): string[] {
  return Array.from(access.projectPermissions.entries())
    .filter(([, perms]) => perms.has("tickets.view"))
    .map(([projectId]) => projectId);
}

/** User có xem được ticket thuộc dự án này không (null = ticket chưa gán) */
export function canViewTicketInProject(access: TicketAccess, projectId: string | null | undefined): boolean {
  if (access.canAssign) return true;
  if (!projectId) return false;
  return access.projectPermissions.get(projectId)?.has("tickets.view") ?? false;
}

/** User có quyền `permission` trên ticket thuộc dự án này không (đã bao gồm điều kiện xem được) */
export function hasTicketPermission(
  access: TicketAccess,
  permission: string,
  projectId: string | null | undefined
): boolean {
  if (access.isAdmin) return true;
  if (permission === "tickets.assign") return access.canAssign;
  if (!canViewTicketInProject(access, projectId)) return false;
  const projectPerms = projectId ? access.projectPermissions.get(projectId) : undefined;
  return (projectPerms || access.globalPermissions).has(permission);
}

// Quyền "xử lý" ticket (đổi trạng thái, ghi chú, phản hồi): có BẤT KỲ quyền ghi nào của nhóm tickets.
// Tương đương canManageTickets() (mọi vai trò trừ VIEWER) với bộ vai trò mặc định.
export const TICKET_WRITE_PERMISSIONS = ["tickets.reply", "tickets.create", "tickets.convert", "tickets.delete"];

export type TicketCapabilities = TicketCapabilitiesDto;

// Thông tin ticket cần để tính quyền hành động (chấp nhận DTO hoặc dòng Prisma)
type TicketStateInput = {
  projectId?: string | null;
  status?: string;
  assigneeId?: string | null;
  acknowledgedAt?: Date | string | null;
  priorityConfirmedAt?: Date | string | null;
};

/** Người thực hiện hành động theo luồng trạng thái (xem checkTicketAction trong ticket-status.ts) */
export function buildTicketActor(access: TicketAccess, projectId: string | null | undefined): TicketActor {
  const canWrite = TICKET_WRITE_PERMISSIONS.some((perm) => hasTicketPermission(access, perm, projectId));
  return {
    userId: access.userId,
    canWrite,
    canAssign: access.canAssign,
    canDelete: hasTicketPermission(access, "tickets.delete", projectId),
    // Người xử lý phải là thành viên (hoặc chủ) dự án của ticket — admin/điều phối ngoài dự án thì không
    isEligibleHandler: Boolean(projectId) && access.projectPermissions.has(projectId as string) && canWrite,
  };
}

/**
 * Quyền thao tác của user trên 1 ticket (gửi kèm DTO để UI ẩn/hiện nút).
 * Truyền projectId (chuỗi) khi chỉ cần quyền theo dự án; truyền ticket để tính cả hành động theo trạng thái.
 */
export function getTicketCapabilities(
  access: TicketAccess,
  ticket: TicketStateInput | string | null | undefined
): TicketCapabilities {
  const t: TicketStateInput = typeof ticket === "object" && ticket !== null ? ticket : { projectId: ticket ?? null };
  const projectId = t.projectId ?? null;
  const actor = buildTicketActor(access, projectId);
  const hasState = typeof t.status === "string";
  const state: TicketWorkflowState = {
    status: t.status || "",
    projectId,
    assigneeId: t.assigneeId ?? null,
    acknowledgedAt: t.acknowledgedAt ?? null,
    priorityConfirmedAt: t.priorityConfirmedAt ?? null,
  };
  const can = (action: TicketActionName, extra?: Parameters<typeof checkTicketAction>[3]) =>
    hasState && checkTicketAction(action, state, actor, extra).ok;

  return {
    canWrite: actor.canWrite,
    // Convert cần ticket đã gán dự án (task được tạo trong dự án đó) và chưa kết thúc
    canConvert:
      Boolean(projectId) && hasTicketPermission(access, "tickets.convert", projectId) && !isTicketFinal(t.status),
    canAssign: access.canAssign,
    canConfirmPriority: can("confirm_priority"),
    canClaim: can("claim"),
    canStart: can("start"),
    canClose: can("close"),
    canCancel: can("cancel"),
    canReopen: can("reopen"),
    // Giao người xử lý: điều phối + ticket đã có dự án + chưa kết thúc (người cụ thể kiểm tra khi gửi)
    canAssignHandler: hasState && access.canAssign && Boolean(projectId) && !isTicketFinal(t.status),
  };
}

/** Có xem được module Ticket không (có tickets.view ở cấp hệ thống hoặc ở ít nhất 1 dự án) */
export function canUseTicketModule(access: TicketAccess): boolean {
  return access.canAssign || getViewableTicketProjectIds(access).length > 0;
}

/** Có được ghi nhận ticket mới không (tickets.create ở cấp hệ thống hoặc ở ít nhất 1 dự án) */
export function canCreateTickets(access: TicketAccess): boolean {
  if (access.isAdmin || access.globalPermissions.has("tickets.create")) return true;
  return Array.from(access.projectPermissions.values()).some((perms) => perms.has("tickets.create"));
}

/** Điều kiện Prisma giới hạn phạm vi ticket user được xem */
export function buildTicketScopeWhere(access: TicketAccess): { projectId?: { in: string[] } } {
  if (access.canAssign) return {};
  return { projectId: { in: getViewableTicketProjectIds(access) } };
}

/** Danh sách dự án cho bộ lọc / điều phối: người điều phối thấy mọi dự án, còn lại chỉ dự án được xem */
export async function getTicketProjectOptions(access: TicketAccess): Promise<TicketProjectOption[]> {
  return prisma.project.findMany({
    where: access.canAssign ? undefined : { id: { in: getViewableTicketProjectIds(access) } },
    select: { id: true, name: true, key: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Tìm ticket theo id hoặc mã tra cứu và kiểm tra user có được xem không.
 * Ticket ngoài phạm vi xem trả 404 (không tiết lộ ticket có tồn tại).
 */
export async function findAccessibleTicket(
  access: TicketAccess,
  ticketIdOrCode: string
): Promise<{
  id: string;
  projectId: string | null;
  convertedTaskId: string | null;
  status: string;
  assigneeId: string | null;
  acknowledgedAt: Date | null;
  priorityConfirmedAt: Date | null;
} | null> {
  const row = await prisma.customerTicket.findFirst({
    where: { OR: [{ id: ticketIdOrCode }, { trackingCode: ticketIdOrCode.toUpperCase() }] },
    select: {
      id: true,
      projectId: true,
      convertedTaskId: true,
      status: true,
      assigneeId: true,
      acknowledgedAt: true,
      priorityConfirmedAt: true,
    },
  });
  if (!row || !canViewTicketInProject(access, row.projectId)) return null;
  return row;
}

/** Chuẩn hóa lỗi requireUser (ném Response 401) trong route handler */
export function ticketRouteError(err: unknown, logLabel: string, fallbackMessage = "Lỗi máy chủ") {
  if (err instanceof Response) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: err.status || 401 });
  }
  console.error(logLabel, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/** Id các tài khoản có tickets.assign theo vai trò hệ thống — người nhận thông báo ticket mới cần điều phối */
export async function getTicketCoordinatorUserIds(): Promise<string[]> {
  await ensureDefaultRoles();
  const roleDefs = await prisma.roleDefinition.findMany({ select: { key: true, permissions: true } });
  const coordinatorRoles = new Set<string>(["ADMIN"]);
  for (const r of roleDefs) {
    try {
      const perms = JSON.parse(r.permissions) as string[];
      if (Array.isArray(perms) && perms.includes("tickets.assign")) coordinatorRoles.add(r.key.toUpperCase());
    } catch {
      // permissions lỗi định dạng -> bỏ qua vai trò này
    }
  }
  // So khớp role không phân biệt hoa thường (nhất quán với getTicketAccess)
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  return users
    .filter((u) => coordinatorRoles.has((u.role || "MEMBER").toUpperCase()))
    .map((u) => u.id);
}

/** Thông báo tới người điều phối (tickets.assign) khi có ticket mới chưa gán dự án */
export async function notifyTicketCoordinators(
  ticket: { id: string; title: string; trackingCode: string; customerName: string; customerEmail: string },
  options?: { actorId?: string; source?: string }
): Promise<void> {
  const coordinatorIds = await getTicketCoordinatorUserIds();
  for (const userId of coordinatorIds) {
    if (userId === options?.actorId) continue;
    await sendNotification({
      userId,
      actorId: options?.actorId,
      type: "TICKET_CREATED",
      title: `🎫 Báo lỗi mới: ${ticket.title}`,
      message: `${options?.source || `Khách hàng ${ticket.customerName} (${ticket.customerEmail})`} vừa gửi ticket "${ticket.trackingCode}". Cần điều phối tới dự án phù hợp.`,
      link: `/tickets?ticketId=${ticket.id}`,
    });
  }
}

/** Id thành viên (kể cả chủ dự án) có tickets.view trong dự án — người nhận thông báo khi ticket được điều phối tới */
export async function getProjectTicketViewerIds(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { select: { userId: true, role: true, user: { select: { role: true } } } },
    },
  });
  if (!project) return [];

  const result: string[] = [];
  for (const m of project.members) {
    const globalRole = (m.user.role || "MEMBER").toUpperCase();
    const projectRole = (m.role || "MEMBER").toUpperCase();
    // Admin hệ thống / chủ dự án: luôn có tickets.view
    if (globalRole === "ADMIN" || projectRole === "OWNER" || project.ownerId === m.userId) {
      result.push(m.userId);
      continue;
    }
    const [globalPerms, projectPerms] = await Promise.all([
      getRolePermissions(globalRole),
      getRolePermissions(projectRole),
    ]);
    if (globalPerms.includes("tickets.view") || projectPerms.includes("tickets.view")) {
      result.push(m.userId);
    }
  }
  return result;
}

/** Cờ hiển thị menu "Ticket Khách Hàng": có tickets.view ở bất kỳ dự án nào hoặc có tickets.assign */
export async function canUserViewTicketModule(user: SessionUser): Promise<boolean> {
  return canUseTicketModule(await getTicketAccess(user));
}
