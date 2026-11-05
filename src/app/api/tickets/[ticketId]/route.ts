import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTicketById, getTicketByTrackingCode, updateTicket, addTicketComment } from "@/lib/tickets";
import { getSessionUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const user = await getSessionUser(req);
    const isStaffOrAdmin = !!user && (user.role === "ADMIN" || user.role === "MEMBER");

    // Chỉ nhân viên nội bộ (Staff / Admin) mới được nạp kèm ghi chú nội bộ (internalNotes, internalComments)
    let ticket = await getTicketById(ticketId, isStaffOrAdmin);
    if (!ticket) {
      ticket = await getTicketByTrackingCode(ticketId);
    }
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }

    // Bảo vệ nhiều lớp: nếu không phải staff/admin, xóa bỏ hoàn toàn trường nhạy cảm
    if (!isStaffOrAdmin) {
      delete (ticket as any).internalNotes;
      if (ticket.comments) {
        ticket.comments = ticket.comments.filter((c: any) => !c.isInternalOnly);
      }
    }

    let project = null;
    if (ticket.projectId) {
      project = await prisma.project.findUnique({
        where: { id: ticket.projectId },
        select: { id: true, name: true, key: true },
      });
    }

    return NextResponse.json({
      ticket: {
        ...ticket,
        project,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tải ticket:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  type: z.enum(["BUG", "SUPPORT", "INQUIRY", "FEATURE_REQ"]).optional(),
  internalNotes: z.string().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
  newComment: z
    .object({
      message: z.string().min(1),
      isInternalOnly: z.boolean().default(false),
    })
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { ticketId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const { newComment, ...ticketUpdates } = parsed.data;

    let updatedTicket = null;
    if (Object.keys(ticketUpdates).length > 0) {
      updatedTicket = await updateTicket(ticketId, ticketUpdates);
    }

    if (newComment) {
      await addTicketComment({
        ticketId,
        authorName: user.name,
        authorEmail: user.email,
        isStaff: true,
        isInternalOnly: newComment.isInternalOnly,
        message: newComment.message,
      });
      updatedTicket = await getTicketById(ticketId, true);
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error("Lỗi cập nhật ticket:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
