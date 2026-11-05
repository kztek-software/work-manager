import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTicketById, getTicketByTrackingCode, addTicketComment } from "@/lib/tickets";
import { getSessionUser } from "@/lib/auth";

const commentSchema = z.object({
  authorName: z.string().min(1, "Vui lòng nhập tên người gửi").max(100),
  authorEmail: z.string().email("Email không hợp lệ").optional().nullable(),
  message: z.string().min(1, "Nội dung phản hồi không được để trống").max(3000),
  isStaff: z.boolean().default(false),
  isInternalOnly: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    let ticket = await getTicketById(ticketId);
    if (!ticket) {
      ticket = await getTicketByTrackingCode(ticketId);
    }

    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    // Kiểm tra phiên đăng nhập thực tế của người gửi để chống giả mạo isStaff / isInternalOnly
    const user = await getSessionUser(req);
    const isActualStaff = !!user && (user.role === "ADMIN" || user.role === "MEMBER");

    // Khách hàng hoặc user chưa đăng nhập tuyệt đối KHÔNG thể tự gắn cờ isStaff hoặc tạo ghi chú nội bộ
    const isStaff = isActualStaff ? (parsed.data.isStaff ?? true) : false;
    const isInternalOnly = isActualStaff ? (parsed.data.isInternalOnly ?? false) : false;
    const authorName = isActualStaff && user ? user.name : parsed.data.authorName;
    const authorEmail = isActualStaff && user ? user.email : parsed.data.authorEmail;

    const comment = await addTicketComment({
      ticketId: ticket.id,
      authorName,
      authorEmail,
      message: parsed.data.message,
      isStaff,
      isInternalOnly,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Lỗi khi thêm bình luận ticket:", error);
    return NextResponse.json(
      { error: "Không thể thêm phản hồi vào lúc này" },
      { status: 500 }
    );
  }
}
