import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { findAccessibleTicket, getTicketAccess, getTicketCapabilities } from "@/lib/ticket-access";

const createAttachmentSchema = z.object({
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileType: z.enum(["image", "video", "document", "other"]).default("other"),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: parsed.error.issues }, { status: 400 });
    }

    const { projectId, taskId, ticketId, fileName, fileUrl, fileType, fileSize, mimeType } = parsed.data;

    if (!projectId && !taskId && !ticketId) {
      return NextResponse.json({ error: "Phải chỉ định projectId, taskId hoặc ticketId" }, { status: 400 });
    }

    const user = await getSessionUser();

    // Đính kèm vào ticket: chỉ nhân viên trong phạm vi xem & có quyền xử lý ticket
    // (khách hàng đính kèm qua payload của POST /api/tickets/public).
    // Lưu theo id thật của ticket đã kiểm quyền (ticketId gửi lên có thể là mã tra cứu).
    let resolvedTicketId: string | null = null;
    if (ticketId) {
      if (!user) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      }
      const access = await getTicketAccess(user);
      const ticket = await findAccessibleTicket(access, ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
      }
      if (!getTicketCapabilities(access, ticket.projectId).canWrite) {
        return NextResponse.json({ error: "Bạn chỉ có quyền xem ticket này" }, { status: 403 });
      }
      resolvedTicketId = ticket.id;
    }

    const attachment = await prisma.attachment.create({
      data: {
        projectId: projectId || null,
        taskId: taskId || null,
        ticketId: resolvedTicketId,
        uploaderId: user?.id || null,
        fileName,
        fileUrl,
        fileType,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
      },
      include: {
        uploader: {
          select: { id: true, name: true, avatarColor: true, title: true },
        },
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("Lỗi tạo attachment:", error);
    return NextResponse.json({ error: "Lỗi kết nối cơ sở dữ liệu" }, { status: 500 });
  }
}
