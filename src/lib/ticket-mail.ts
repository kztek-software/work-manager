import { prisma } from "@/lib/prisma";
import { sendTicketCustomerEmail } from "@/lib/mail";
import { TICKET_FINAL_STATUSES } from "@/lib/ticket-status";

// Trạng thái được coi là "có kết quả" (Đã đóng / Đã hủy) -> gửi email kết quả xử lý cho khách hàng
export const TICKET_RESULT_STATUSES: readonly string[] = TICKET_FINAL_STATUSES;

type TicketSnapshot = { status: string; resolutionNotes?: string | null };

/**
 * Có cần gửi email KẾT QUẢ không:
 * - Ticket vừa chuyển sang trạng thái có kết quả (CLOSED / CANCELLED), hoặc
 * - Ticket đang ở trạng thái có kết quả và nội dung kết quả xử lý vừa được cập nhật.
 */
export function shouldSendResultEmail(before: TicketSnapshot, after: TicketSnapshot): boolean {
  if (!TICKET_RESULT_STATUSES.includes(after.status)) return false;
  if (before.status !== after.status) return true;
  return (before.resolutionNotes || "").trim() !== (after.resolutionNotes || "").trim() && Boolean(after.resolutionNotes?.trim());
}

/**
 * Gửi email cho khách hàng (không chặn request; lỗi chỉ ghi log).
 * - RESULT: kết quả xử lý khi Đóng / Hủy (kèm lý do closeReason + mô tả resolutionNotes)
 * - REPLY: phản hồi công khai mới từ nhân viên (không gửi cho bình luận nội bộ)
 */
export function notifyCustomerAboutTicket(params: {
  ticketId: string;
  kind: "RESULT" | "REPLY";
  replyHtml?: string | null;
  staffName?: string | null;
  // RESULT: kết quả lúc commit (Đóng / Hủy) — ưu tiên hơn dữ liệu đọc lại từ DB
  snapshot?: { status: string; closeReason: string | null; resolutionNotes: string | null };
}): void {
  void (async () => {
    try {
      const ticket = await prisma.customerTicket.findUnique({
        where: { id: params.ticketId },
        select: {
          trackingCode: true,
          title: true,
          status: true,
          customerName: true,
          customerEmail: true,
          resolutionNotes: true,
          closeReason: true,
        },
      });
      if (!ticket?.customerEmail) return;

      const entry = await sendTicketCustomerEmail({
        kind: params.kind,
        trackingCode: ticket.trackingCode,
        title: ticket.title,
        status: params.snapshot?.status ?? ticket.status,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        bodyHtml:
          params.kind === "RESULT" ? params.snapshot?.resolutionNotes ?? ticket.resolutionNotes : params.replyHtml,
        closeReason: params.kind === "RESULT" ? params.snapshot?.closeReason ?? ticket.closeReason : null,
        staffName: params.staffName,
      });
      if (entry.status !== "SENT") {
        console.warn(
          `[ticket-mail] Email ${params.kind} cho ticket ${ticket.trackingCode} chưa được gửi thật (trạng thái: ${entry.status}). Kiểm tra cấu hình SMTP.`
        );
      }
    } catch (err) {
      console.error("[ticket-mail] Lỗi gửi email cho khách hàng:", err);
    }
  })();
}
