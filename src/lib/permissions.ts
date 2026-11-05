export type PermissionItem = {
  key: string;
  name: string;
  description: string;
};

export type PermissionCategory = {
  id: string;
  name: string;
  description: string;
  permissions: PermissionItem[];
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "projects",
    name: "Quản trị & Thiết lập Dự án",
    description: "Quyền khởi tạo, cấu hình, chuyển trạng thái và quản trị các dự án",
    permissions: [
      { key: "projects.view_all", name: "Xem tất cả dự án", description: "Xem toàn bộ danh mục và tiến độ các dự án trong hệ thống" },
      { key: "projects.create", name: "Tạo dự án mới", description: "Khởi tạo workspace và dự án mới trên hệ thống" },
      { key: "projects.edit", name: "Chỉnh sửa thông tin dự án", description: "Đổi tên, mã key, mục tiêu và chủ sở hữu dự án" },
      { key: "projects.status", name: "Đổi trạng thái dự án", description: "Cập nhật tiến độ: Đang chạy, Kế hoạch, Tạm dừng, Hoàn thành" },
      { key: "projects.labels", name: "Quản lý Nhãn & Phân loại", description: "Tạo, sửa, xóa nhãn (labels/tags) gắn vào công việc" },
      { key: "projects.archive", name: "Lưu trữ / Đóng dự án", description: "Đưa dự án vào kho lưu trữ khi hoàn tất" },
      { key: "projects.delete", name: "Xóa vĩnh viễn dự án", description: "Xóa dự án và toàn bộ dữ liệu công việc khỏi hệ thống" },
    ],
  },
  {
    id: "tasks",
    name: "Quản lý Công việc & Kanban",
    description: "Quyền xem, tạo, sửa, xóa, phân công và kéo thả công việc",
    permissions: [
      { key: "tasks.view", name: "Xem công việc & Board", description: "Xem danh sách công việc và chi tiết task" },
      { key: "tasks.create", name: "Tạo công việc mới", description: "Tạo task, bug, story, epic mới" },
      { key: "tasks.edit", name: "Chỉnh sửa công việc", description: "Cập nhật tiêu đề, mô tả, hạn chót, points" },
      { key: "tasks.move_status", name: "Kéo thả / Đổi trạng thái", description: "Di chuyển task giữa các cột trên Board" },
      { key: "tasks.assign", name: "Phân công người phụ trách", description: "Giao việc hoặc thay đổi người nhận task" },
      { key: "tasks.delete", name: "Xóa vĩnh viễn công việc", description: "Xóa task khỏi hệ thống" },
      { key: "tasks.comment", name: "Bình luận & Trao đổi", description: "Gửi bình luận vào các task" },
      { key: "tasks.subtask", name: "Quản lý Checklist / Subtask", description: "Thêm và đánh dấu hoàn thành việc con" },
    ],
  },
  {
    id: "sprints",
    name: "Kế hoạch & Sprints",
    description: "Quyền lập kế hoạch chu kỳ phát triển",
    permissions: [
      { key: "sprints.view", name: "Xem danh sách Sprint", description: "Xem tiến độ và mục tiêu sprint" },
      { key: "sprints.create", name: "Tạo Sprint mới", description: "Lên kế hoạch tạo sprint mới" },
      { key: "sprints.manage", name: "Kích hoạt & Đóng Sprint", description: "Bắt đầu chạy hoặc kết thúc sprint" },
    ],
  },
  {
    id: "reports",
    name: "Báo cáo & Hiệu suất (KPI)",
    description: "Quyền theo dõi biểu đồ Burndown, Velocity và KPI nhân sự",
    permissions: [
      { key: "reports.view_overview", name: "Xem biểu đồ tổng quan", description: "Xem Burndown, Velocity và phân bổ độ ưu tiên" },
      { key: "reports.view_accounts", name: "Xem báo cáo theo tài khoản", description: "Xem chi tiết KPI, tiến độ của từng nhân viên" },
      { key: "reports.export", name: "Xuất dữ liệu báo cáo", description: "Xuất dữ liệu báo cáo ra file" },
    ],
  },
  {
    id: "members",
    name: "Đội ngũ & Thành viên Dự án",
    description: "Quyền điều phối nhân sự và phân quyền trong dự án",
    permissions: [
      { key: "members.view", name: "Xem danh sách thành viên", description: "Xem những ai tham gia dự án" },
      { key: "members.add", name: "Thêm thành viên vào dự án", description: "Thêm tài khoản nhân sự vào dự án" },
      { key: "members.change_role", name: "Đổi vai trò thành viên", description: "Thay đổi vai trò (ADMIN, TECH_LEAD, DEVELOPER...)" },
      { key: "members.remove", name: "Xóa thành viên khỏi dự án", description: "Loại bỏ người dùng khỏi dự án" },
    ],
  },
  {
    id: "tickets",
    name: "Khách hàng & Ticket Hỗ trợ",
    description: "Quyền tiếp nhận, xử lý và phản hồi vé yêu cầu từ khách hàng",
    permissions: [
      { key: "tickets.view", name: "Xem danh sách Ticket", description: "Xem các yêu cầu và lỗi do khách hàng gửi" },
      { key: "tickets.create", name: "Tạo / Tiếp nhận Ticket", description: "Tạo phiếu hỗ trợ hoặc ghi nhận yêu cầu mới" },
      { key: "tickets.reply", name: "Phản hồi & Trao đổi", description: "Gửi phản hồi và bình luận trong ticket" },
      { key: "tickets.convert", name: "Chuyển Ticket thành Task", description: "Chuyển đổi yêu cầu khách hàng thành task trên Board" },
      { key: "tickets.delete", name: "Đóng & Xóa Ticket", description: "Đóng phiếu xử lý hoặc xóa vé rác" },
      { key: "tickets.assign", name: "Gán / Điều phối dự án cho Ticket", description: "Xem toàn bộ ticket (kể cả chưa gán) và gán, đổi hoặc bỏ gán dự án phụ trách. Chỉ có hiệu lực theo vai trò hệ thống của tài khoản" },
    ],
  },
  {
    id: "notion",
    name: "Tích hợp & Di chuyển dữ liệu",
    description: "Quyền kết nối và nhập dữ liệu từ bên ngoài",
    permissions: [
      { key: "notion.migrate", name: "Đồng bộ & Migrate Notion", description: "Kết nối Notion API và nhập dữ liệu vào Board" },
    ],
  },
  {
    id: "system",
    name: "Quản trị Hệ thống",
    description: "Quyền quản trị cấp cao toàn hệ thống",
    permissions: [
      { key: "users.manage", name: "Quản lý Tài khoản người dùng", description: "Tạo, sửa, cấp lại mật khẩu và xóa user" },
      { key: "roles.manage", name: "Cấu hình Ma trận Phân quyền", description: "Chỉnh sửa quyền và thêm vai trò mới" },
      { key: "email.config", name: "Cấu hình Email & SMTP", description: "Thiết lập máy chủ gửi email và thông báo" },
    ],
  },
];

// Tất cả các permission keys phẳng
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

// Quyền cấp hệ thống: Chủ dự án (Owner) KHÔNG tự động có các quyền này.
// tickets.assign cho phép xem/điều phối ticket của MỌI dự án nên không được cấp theo quyền Owner của 1 dự án.
export function isSystemLevelPermission(key: string): boolean {
  return (
    key.startsWith("system.") ||
    key === "users.manage" ||
    key === "roles.manage" ||
    key === "email.config" ||
    key === "tickets.assign"
  );
}

// Quyền được xét CHỈ theo vai trò hệ thống (User.role), không cộng dồn từ vai trò trong dự án
export const GLOBAL_ROLE_ONLY_PERMISSIONS: string[] = ["tickets.assign"];

// Bảng cấu hình mặc định (Default Presets)
export const DEFAULT_ROLE_PRESETS: {
  key: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  permissions: string[];
}[] = [
  {
    key: "ADMIN",
    name: "Quản trị viên (Admin)",
    description: "Toàn quyền quản trị hệ thống, dự án, thành viên và phân quyền",
    color: "#F05922",
    isSystem: true,
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    key: "OWNER",
    name: "Chủ dự án (Owner / PM)",
    description: "Toàn quyền trong phạm vi dự án, quản lý công việc, sprint, báo cáo và thành viên",
    color: "#8B5CF6",
    isSystem: true,
    // Vai trò hệ thống OWNER (tài khoản quản trị) được điều phối ticket.
    // tickets.assign nằm trong GLOBAL_ROLE_ONLY_PERMISSIONS nên chủ của 1 dự án KHÔNG nhận quyền này qua vai trò dự án.
    permissions: ALL_PERMISSION_KEYS.filter((k) => !isSystemLevelPermission(k) || k === "tickets.assign"),
  },
  {
    key: "TECH_LEAD",
    name: "Trưởng nhóm kỹ thuật (Tech Lead)",
    description: "Quản lý công việc, sprint, phân bổ task, phê duyệt và xem toàn bộ báo cáo",
    color: "#3B82F6",
    isSystem: false,
    permissions: [
      "projects.view_all", "projects.edit", "projects.status", "projects.labels",
      "tasks.view", "tasks.create", "tasks.edit", "tasks.move_status", "tasks.assign", "tasks.comment", "tasks.subtask",
      "sprints.view", "sprints.create", "sprints.manage",
      "reports.view_overview", "reports.view_accounts", "reports.export",
      "members.view", "members.add",
      "tickets.view", "tickets.reply", "tickets.convert",
      "notion.migrate",
    ],
  },
  {
    key: "DEVELOPER",
    name: "Lập trình viên (Developer)",
    description: "Xem, tạo, cập nhật tiến độ công việc được giao, hoàn thành checklist và bình luận",
    color: "#10B981",
    isSystem: false,
    permissions: [
      "tasks.view", "tasks.create", "tasks.edit", "tasks.move_status", "tasks.comment", "tasks.subtask",
      "sprints.view",
      "reports.view_overview",
      "members.view",
      "tickets.view", "tickets.reply",
    ],
  },
  {
    key: "MEMBER",
    name: "Thành viên (Member)",
    description: "Thành viên tiêu chuẩn thực hiện các công việc và cập nhật tiến độ",
    color: "#6366F1",
    isSystem: true,
    permissions: [
      "tasks.view", "tasks.create", "tasks.edit", "tasks.move_status", "tasks.comment", "tasks.subtask",
      "sprints.view",
      "reports.view_overview",
      "members.view",
      "tickets.view", "tickets.create",
    ],
  },
  {
    key: "TESTER",
    name: "Kiểm thử viên (QA / QC)",
    description: "Tạo bug, di chuyển trạng thái review/done, bình luận và theo dõi báo cáo chất lượng",
    color: "#F59E0B",
    isSystem: false,
    permissions: [
      "tasks.view", "tasks.create", "tasks.edit", "tasks.move_status", "tasks.comment", "tasks.subtask",
      "sprints.view",
      "reports.view_overview", "reports.view_accounts",
      "members.view",
      "tickets.view", "tickets.create", "tickets.reply", "tickets.convert",
    ],
  },
  {
    key: "VIEWER",
    name: "Người xem (Viewer)",
    description: "Chỉ được xem thông tin công việc, sprint và báo cáo, không được chỉnh sửa",
    color: "#64748B",
    isSystem: true,
    permissions: [
      "tasks.view",
      "sprints.view",
      "reports.view_overview",
      "members.view",
      "tickets.view",
    ],
  },
];

export type ProjectRole = "OWNER" | "ADMIN" | "TECH_LEAD" | "DEVELOPER" | "MEMBER" | "TESTER" | "VIEWER" | string;

export const PROJECT_ROLES: { id: string; label: string; description: string }[] = [
  { id: "OWNER", label: "Chủ dự án (Owner)", description: "Toàn quyền quản lý dự án" },
  { id: "ADMIN", label: "Quản trị viên (Admin)", description: "Toàn quyền cấu hình & quản lý" },
  { id: "TECH_LEAD", label: "Trưởng nhóm kỹ thuật", description: "Quản lý task, sprint, phê duyệt" },
  { id: "MEMBER", label: "Thành viên (Member)", description: "Xem, tạo, nhận và cập nhật task" },
  { id: "VIEWER", label: "Người xem (Viewer)", description: "Chỉ được xem thông tin" },
];

export function canManageMembers(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm === "ADMIN" || norm === "OWNER" || norm === "TECH_LEAD";
}

export function canCreateProject(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm === "ADMIN" || norm === "OWNER";
}

export function canEditProject(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm === "ADMIN" || norm === "OWNER" || norm === "TECH_LEAD";
}

export function canDeleteProject(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm === "ADMIN" || norm === "OWNER";
}

export function canManageTickets(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm !== "VIEWER";
}

// Synchronous Helpers (Client & Server safe)
export function canCreateTask(role?: string | null): boolean {
  if (!role) return false;
  return role.toUpperCase() !== "VIEWER";
}

export function canEditTask(role?: string | null): boolean {
  if (!role) return false;
  return role.toUpperCase() !== "VIEWER";
}

export function canDeleteTask(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toUpperCase();
  return norm === "ADMIN" || norm === "OWNER" || norm === "TECH_LEAD" || norm === "MEMBER";
}

export function isViewer(role?: string | null): boolean {
  return role?.toUpperCase() === "VIEWER";
}
