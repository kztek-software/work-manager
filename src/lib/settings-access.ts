import { getRolePermissions } from "@/lib/permissions-server";
import {
  SETTINGS_SECTION_PERMISSIONS,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/lib/permissions";

export type SettingsAccess = {
  canView: boolean;
  canEdit: Record<SettingsSection, boolean>;
};

/**
 * Quyền trên trang Cấu hình & Cài đặt — CHỈ xét theo vai trò hệ thống (User.role), vì cấu hình áp dụng
 * cho toàn hệ thống (xem GLOBAL_ROLE_ONLY_PERMISSIONS). ADMIN luôn có toàn quyền (getRolePermissions).
 * Có quyền sửa bất kỳ tab nào thì được xem trang.
 */
export async function getSettingsAccess(user: { role: string }): Promise<SettingsAccess> {
  const perms = new Set(await getRolePermissions(user.role));
  const canEdit = Object.fromEntries(
    SETTINGS_SECTIONS.map((section) => [section, perms.has(SETTINGS_SECTION_PERMISSIONS[section])])
  ) as Record<SettingsSection, boolean>;
  const canView = perms.has("settings.view") || Object.values(canEdit).some(Boolean);
  return { canView, canEdit };
}
