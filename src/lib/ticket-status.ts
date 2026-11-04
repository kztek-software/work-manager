// ---------------------------------------------------------------------------
// Luồng trạng thái Ticket khách hàng — dùng chung client & server (KHÔNG import prisma ở đây).
//
//   OPEN (Mới) -> ACKNOWLEDGED (Đã tiếp nhận) -> TRIAGED (Đã phân loại) -> IN_PROGRESS (Đang xử lý)
//        -> CLOSED (Đã đóng) | CANCELLED (Đã hủy)
//
// - OPEN -> ACKNOWLEDGED: tự động khi nhân viên có quyền xem mở chi tiết ticket lần đầu.
// - -> TRIAGED: tự động khi ĐỦ CẢ HAI: nhân viên đã xác nhận mức ưu tiên + ticket đã gán dự án.
// - TRIAGED -> IN_PROGRESS: người xử lý (hoặc người điều phối) bấm "Bắt đầu xử lý".
// - Đóng / Hủy: bắt buộc lý do + mô tả. Mở lại: chỉ người điều phối (tickets.assign).
// Server là nguồn sự thật: mọi chuyển trạng thái đi qua checkTicketAction / computeAutoStatus.
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = ["OPEN", "ACKNOWLEDGED", "TRIAGED", "IN_PROGRESS", "CLOSED", "CANCELLED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Trạng thái kết thúc (đã có kết quả) -> gửi email kết quả cho khách hàng
export const TICKET_FINAL_STATUSES: readonly string[] = ["CLOSED", "CANCELLED"];

export function isTicketFinal(status: string | null | undefined): boolean {
  return TICKET_FINAL_STATUSES.includes(status || "");
}

// Nhãn hiển thị nội bộ (label) và cho khách hàng (customerLabel)
export const TICKET_STATUS_META: Record<TicketStatus, { label: string; customerLabel: string; description: string }> = {
  OPEN: { label: "Mới", customerLabel: "Mới tiếp nhận", description: "Yêu cầu vừa được gửi tới hệ thống" },
  ACKNOWLEDGED: { label: "Đã tiếp nhận", customerLabel: "Đã tiếp nhận", description: "Nhân viên đã xem yêu cầu" },
  TRIAGED: { label: "Đã phân loại", customerLabel: "Đã phân loại", description: "Đã xác nhận mức ưu tiên và đội phụ trách" },
  IN_PROGRESS: { label: "Đang xử lý", customerLabel: "Đang xử lý", description: "Kỹ thuật viên đang xử lý" },
  CLOSED: { label: "Đã đóng", customerLabel: "Đã đóng", description: "Yêu cầu đã được xử lý xong" },
  CANCELLED: { label: "Đã hủy", customerLabel: "Đã hủy", description: "Yêu cầu đã bị hủy" },
};

export function ticketStatusLabel(status: string | null | undefined): string {
  return TICKET_STATUS_META[status as TicketStatus]?.label || status || "";
}

// Các bước của stepper (luồng chính, CANCELLED hiển thị riêng ở bước cuối)
export const TICKET_STEPPER: TicketStatus[] = ["OPEN", "ACKNOWLEDGED", "TRIAGED", "IN_PROGRESS", "CLOSED"];

/** Vị trí bước trên stepper (CANCELLED dùng chung bước cuối) */
export function ticketStepIndex(status: string | null | undefined): number {
  if (status === "CANCELLED") return TICKET_STEPPER.length - 1;
  const idx = TICKET_STEPPER.indexOf(status as TicketStatus);
  return idx < 0 ? 0 : idx;
}

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const TICKET_CLOSE_REASONS = [
  "Đã khắc phục",
  "Đã hướng dẫn / giải đáp",
  "Hoạt động đúng thiết kế",
  "Khác",
] as const;

export const TICKET_CANCEL_REASONS = [
  "Trùng lặp",
  "Khách hàng rút yêu cầu",
  "Không đủ thông tin",
  "Ngoài phạm vi hỗ trợ",
  "Khác",
] as const;

const NAMED_ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Bỏ tag HTML của trình soạn thảo -> văn bản thuần (để kiểm tra mô tả rỗng):
 * decode entity (&nbsp; &#160; &#x20; ...), bỏ ký tự zero-width, gom khoảng trắng.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
}

function safeFromCodePoint(code: number): string {
  try {
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

/** Văn bản thuần (textarea) -> HTML an toàn: escape ký tự đặc biệt, xuống dòng thành <br> */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}

/**
 * Nội dung HTML có nhúng ảnh/tệp dạng data: URI không (src= / srcset= / href=, cho phép khoảng trắng
 * quanh dấu "=" và sau dấu nháy). Ảnh phải tải lên qua /api/upload, không nhúng base64 vào DB/email.
 */
export function hasInlineDataUri(html: string | null | undefined): boolean {
  return /\b(?:src|srcset|href)\s*=\s*["']?\s*data:/i.test(html || "");
}

// Khách phản hồi trên ticket đã Đóng / Hủy
export const TICKET_FINISHED_CUSTOMER_MESSAGE = "Yêu cầu đã kết thúc, vui lòng gửi yêu cầu mới";

export const INLINE_DATA_URI_ERROR = "Ảnh phải được tải lên, không nhúng trực tiếp. Vui lòng dán lại ảnh.";

/** Lỗi nghiệp vụ của luồng trạng thái -> route trả httpStatus + thông báo tiếng Việt */
export class TicketWorkflowError extends Error {
  constructor(public httpStatus: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Luật chuyển trạng thái (hàm thuần — test được không cần DB)
// ---------------------------------------------------------------------------

export type TicketWorkflowState = {
  status: string;
  projectId: string | null;
  assigneeId: string | null;
  acknowledgedAt: Date | string | null;
  priorityConfirmedAt: Date | string | null;
};

/**
 * Trạng thái tự động theo điều kiện hiện tại của ticket (không áp dụng cho ticket đã Đóng/Hủy):
 * - Mất dự án khi đang TRIAGED / IN_PROGRESS -> lùi về ACKNOWLEDGED.
 * - IN_PROGRESS nhưng không còn người xử lý -> lùi về TRIAGED.
 * - OPEN / ACKNOWLEDGED và đủ (đã xác nhận ưu tiên + đã gán dự án) -> TRIAGED
 *   (từ OPEN nhảy thẳng, đồng thời đánh dấu đã tiếp nhận).
 */
export function computeAutoStatus(state: TicketWorkflowState): { status: string; markAcknowledged: boolean } {
  const { status } = state;
  // Đã Đóng/Hủy hoặc trạng thái lạ (dữ liệu cũ chưa migrate) -> không tự đổi
  if (isTicketFinal(status) || !TICKET_STATUSES.includes(status as TicketStatus)) {
    return { status, markAcknowledged: false };
  }
  // Đã phân loại = có dự án + nhân viên đã xác nhận mức ưu tiên
  const classified = Boolean(state.projectId && state.priorityConfirmedAt);

  if (!classified && (status === "TRIAGED" || status === "IN_PROGRESS")) {
    return { status: "ACKNOWLEDGED", markAcknowledged: !state.acknowledgedAt };
  }
  if (status === "IN_PROGRESS" && !state.assigneeId) {
    return { status: "TRIAGED", markAcknowledged: false };
  }
  if ((status === "OPEN" || status === "ACKNOWLEDGED") && classified) {
    return { status: "TRIAGED", markAcknowledged: !state.acknowledgedAt };
  }
  return { status, markAcknowledged: false };
}

/**
 * Trạng thái sau khi mở lại ticket đã Đóng / Hủy (cùng quy tắc với computeAutoStatus):
 * đã phân loại + có người xử lý -> IN_PROGRESS; đã phân loại -> TRIAGED; còn lại -> ACKNOWLEDGED.
 */
export function computeReopenStatus(state: Omit<TicketWorkflowState, "status">): TicketStatus {
  const classified = Boolean(state.projectId && state.priorityConfirmedAt);
  if (classified && state.assigneeId) return "IN_PROGRESS";
  if (classified) return "TRIAGED";
  return "ACKNOWLEDGED";
}

export type TicketActionName = "confirm_priority" | "claim" | "assign" | "start" | "close" | "cancel" | "reopen";

export type TicketActor = {
  userId: string;
  // Có quyền xử lý ticket trong dự án của ticket (xem getTicketCapabilities().canWrite)
  canWrite: boolean;
  // Có tickets.assign (người điều phối)
  canAssign: boolean;
  // Có tickets.delete trong dự án của ticket (được Đóng / Hủy)
  canDelete: boolean;
  // Là thành viên dự án của ticket VÀ có quyền xử lý -> đủ điều kiện làm người xử lý
  isEligibleHandler: boolean;
};

export type TicketActionCheck = { ok: true } | { ok: false; httpStatus: 400 | 403 | 409; error: string };

const fail = (httpStatus: 400 | 403 | 409, error: string): TicketActionCheck => ({ ok: false, httpStatus, error });

/**
 * Kiểm tra 1 hành động có hợp lệ với trạng thái hiện tại & quyền của người thực hiện không.
 * extra.targetEligible: (assign) người được gán có đủ điều kiện xử lý không; extra.targetId = null -> bỏ gán.
 */
export function checkTicketAction(
  action: TicketActionName,
  state: TicketWorkflowState,
  actor: TicketActor,
  extra?: { targetId?: string | null; targetEligible?: boolean }
): TicketActionCheck {
  const final = isTicketFinal(state.status);
  const isAssignee = Boolean(state.assigneeId) && state.assigneeId === actor.userId;
  // Người xử lý chỉ có quyền thao tác khi VẪN là thành viên dự án có quyền xử lý ticket
  const isActiveAssignee = isAssignee && actor.isEligibleHandler && actor.canWrite;

  switch (action) {
    case "confirm_priority":
      if (!actor.canWrite) return fail(403, "Bạn không có quyền xác nhận mức ưu tiên của ticket này");
      if (final) return fail(409, "Ticket đã đóng / hủy, không thể đổi mức ưu tiên");
      return { ok: true };

    case "claim":
      if (final) return fail(409, "Ticket đã đóng / hủy, không thể nhận xử lý");
      if (!state.projectId) return fail(409, "Ticket chưa được gán dự án, chưa thể nhận xử lý");
      if (!actor.isEligibleHandler) {
        return fail(403, "Chỉ thành viên dự án có quyền xử lý ticket mới được nhận xử lý");
      }
      if (isAssignee) return fail(409, "Bạn đang là người xử lý ticket này");
      if (state.assigneeId && !actor.canAssign) return fail(409, "Ticket đã có người xử lý");
      return { ok: true };

    case "assign":
      if (!actor.canAssign) return fail(403, "Bạn không có quyền giao người xử lý (Yêu cầu quyền: tickets.assign)");
      if (final) return fail(409, "Ticket đã đóng / hủy, không thể giao người xử lý");
      if (!state.projectId) return fail(409, "Cần gán dự án cho ticket trước khi giao người xử lý");
      if (extra?.targetId === undefined) return fail(400, "Vui lòng chọn người xử lý");
      if (extra.targetId === null) {
        return state.assigneeId ? { ok: true } : fail(409, "Ticket chưa có người xử lý");
      }
      if (extra.targetId === state.assigneeId) return fail(409, "Người này đang là người xử lý ticket");
      if (!extra.targetEligible) {
        return fail(400, "Người được chọn không phải thành viên dự án có quyền xử lý ticket");
      }
      return { ok: true };

    case "start":
      if (!isActiveAssignee && !actor.canAssign) {
        return fail(
          403,
          isAssignee
            ? "Bạn không còn quyền xử lý ticket trong dự án này"
            : "Chỉ người xử lý được giao (hoặc người điều phối) mới được bắt đầu xử lý"
        );
      }
      if (state.status === "IN_PROGRESS") return fail(409, "Ticket đang được xử lý");
      if (state.status !== "TRIAGED") {
        return fail(409, "Chỉ bắt đầu xử lý được khi ticket ở trạng thái Đã phân loại");
      }
      if (!state.assigneeId) return fail(409, "Cần giao người xử lý trước khi bắt đầu xử lý");
      return { ok: true };

    case "close":
    case "cancel":
      if (final) return fail(409, "Ticket đã đóng / hủy");
      if (!isActiveAssignee && !actor.canAssign && !actor.canDelete) {
        return fail(
          403,
          isAssignee
            ? "Bạn không còn quyền xử lý ticket trong dự án này"
            : "Chỉ người xử lý, người điều phối hoặc người có quyền Đóng ticket mới được thực hiện"
        );
      }
      // Đóng = đã xử lý xong -> chỉ từ Đang xử lý. Hủy được ở mọi trạng thái chưa kết thúc.
      if (action === "close" && state.status !== "IN_PROGRESS") {
        return fail(409, "Chỉ đóng được ticket đang xử lý. Nếu không xử lý, hãy dùng Hủy ticket.");
      }
      return { ok: true };

    case "reopen":
      if (!actor.canAssign) return fail(403, "Chỉ người điều phối (tickets.assign) mới được mở lại ticket");
      if (!final) return fail(409, "Chỉ mở lại được ticket đã đóng / hủy");
      return { ok: true };

    default:
      return fail(400, "Hành động không hợp lệ");
  }
}
