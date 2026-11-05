import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hasInlineDataUri,
  INLINE_DATA_URI_ERROR,
  isTicketFinal,
  TICKET_FINISHED_CUSTOMER_MESSAGE,
} from "@/lib/ticket-status";
import { getTicketByTrackingCode, addTicketComment } from "@/lib/tickets";

// Khách hàng chỉ gửi được phản hồi công khai — isStaff / isInternalOnly luôn false
const publicCommentSchema = z.object({
  authorName: z.string().trim().min(1, "Vui lòng nhập tên người gửi").max(100),
  authorEmail: z.string().trim().email("Email không hợp lệ").optional().nullable(),
  message: z.string().trim().min(1, "Nội dung phản hồi không được để trống").max(10000, "Nội dung phản hồi quá dài (tối đa 10.000 ký tự)")
    .refine((v) => !hasInlineDataUri(v), { message: INLINE_DATA_URI_ERROR }),
});

// POST /api/tickets/public/[trackingCode]/comments -> Khách hàng phản hồi trên trang tra cứu
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackingCode: string }> }
) {
  try {
    const { trackingCode } = await params;
    const ticket = await getTicketByTrackingCode(decodeURIComponent(trackingCode).trim().toUpperCase());
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }
    // Ticket đã Đóng / Hủy: khách không phản hồi tiếp, cần gửi yêu cầu mới
    if (isTicketFinal(ticket.status)) {
      return NextResponse.json({ error: TICKET_FINISHED_CUSTOMER_MESSAGE }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    const parsed = publicCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const comment = await addTicketComment({
      ticketId: ticket.id,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail,
      message: parsed.data.message,
      isStaff: false,
      isInternalOnly: false,
    });

    // Không trả email người gửi về portal (nhất quán với toPublicTicketDto)
    return NextResponse.json({ comment: { ...comment, authorEmail: null } }, { status: 201 });
  } catch (error) {
    console.error("Lỗi khi thêm phản hồi của khách hàng:", error);
    return NextResponse.json(
      { error: "Không thể thêm phản hồi vào lúc này" },
      { status: 500 }
    );
  }
}
