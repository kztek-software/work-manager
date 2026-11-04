import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasInlineDataUri, INLINE_DATA_URI_ERROR } from "@/lib/ticket-status";
import { addTicketComment } from "@/lib/tickets";
import { requireUser } from "@/lib/auth";
import { notifyCustomerAboutTicket } from "@/lib/ticket-mail";
import {
  findAccessibleTicket,
  getTicketAccess,
  getTicketCapabilities,
  ticketRouteError,
} from "@/lib/ticket-access";

// POST /api/tickets/[ticketId]/comments -> Nhân viên phản hồi ticket.
// Khách hàng phản hồi qua /api/tickets/public/[trackingCode]/comments.
const commentSchema = z.object({
  message: z.string().min(1, "Nội dung phản hồi không được để trống").max(10000, "Nội dung phản hồi quá dài (tối đa 10.000 ký tự)")
    .refine((v) => !hasInlineDataUri(v), { message: INLINE_DATA_URI_ERROR }),
  isInternalOnly: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { ticketId } = await params;

    const access = await getTicketAccess(user);
    const row = await findAccessibleTicket(access, ticketId);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }
    if (!getTicketCapabilities(access, row.projectId).canWrite) {
      return NextResponse.json(
        { error: "Bạn chỉ có quyền xem ticket này, không thể phản hồi" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const comment = await addTicketComment({
      ticketId: row.id,
      authorName: user.name,
      authorEmail: user.email,
      message: parsed.data.message,
      isStaff: true,
      isInternalOnly: parsed.data.isInternalOnly,
      actorId: user.id,
    });

    // Phản hồi công khai -> gửi email cho khách hàng (bình luận nội bộ không gửi)
    if (!parsed.data.isInternalOnly) {
      notifyCustomerAboutTicket({ ticketId: row.id, kind: "REPLY", replyHtml: parsed.data.message, staffName: user.name });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return ticketRouteError(error, "Lỗi khi thêm bình luận ticket:", "Không thể thêm phản hồi vào lúc này");
  }
}
