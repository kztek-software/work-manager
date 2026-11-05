import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dispatchTicketToProject, getTicketById, publishTicketEvent } from "@/lib/tickets";
import { applyAutoStatusTransitions } from "@/lib/ticket-workflow";
import { isTicketFinal, TicketWorkflowError } from "@/lib/ticket-status";
import { sendNotification } from "@/lib/notifications";
import {
  findAccessibleTicket,
  getTicketAccess,
  getProjectTicketViewerIds,
  getTicketCapabilities,
  ticketRouteError,
} from "@/lib/ticket-access";

// targetProjectId = null (tường minh) -> bỏ gán dự án (trả ticket về hàng chờ điều phối).
// Chuỗi rỗng KHÔNG được hiểu là bỏ gán -> 400.
const dispatchSchema = z
  .object({
    targetProjectId: z.string().min(1, "Mã dự án không hợp lệ").nullable().optional(),
    projectId: z.string().min(1, "Mã dự án không hợp lệ").nullable().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.targetProjectId !== undefined || data.projectId !== undefined, {
    message: "Vui lòng chọn dự án đích",
    path: ["targetProjectId"],
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const access = await getTicketAccess(user);

    // Gán / đổi / bỏ gán dự án: bắt buộc quyền tickets.assign (không còn điều kiện "thành viên dự án đích")
    if (!access.canAssign) {
      return NextResponse.json(
        { error: "Bạn không có quyền điều phối ticket (Yêu cầu quyền: tickets.assign)" },
        { status: 403 }
      );
    }

    const { ticketId } = await params;
    const row = await findAccessibleTicket(access, ticketId);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket để điều phối" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = dispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const targetProjectId: string | null =
      parsed.data.targetProjectId !== undefined ? parsed.data.targetProjectId : parsed.data.projectId ?? null;

    // Không đổi gì -> không ghi comment điều phối thừa
    if (targetProjectId === row.projectId) {
      return NextResponse.json(
        { error: targetProjectId ? "Ticket đang thuộc dự án này" : "Ticket đang ở hàng chờ điều phối" },
        { status: 400 }
      );
    }

    const targetProject = targetProjectId
      ? await prisma.project.findUnique({
          where: { id: targetProjectId },
          select: { id: true, name: true },
        })
      : null;

    if (targetProjectId && !targetProject) {
      return NextResponse.json({ error: "Không tìm thấy dự án đích" }, { status: 404 });
    }

    if (isTicketFinal(row.status)) {
      return NextResponse.json({ error: "Ticket đã đóng / hủy, không thể điều phối" }, { status: 409 });
    }

    // Đổi dự án + xử lý người xử lý / trạng thái tự động trong 1 transaction
    const actorRef = { id: user.id, name: user.name };
    try {
      await prisma.$transaction(async (tx) => {
        await dispatchTicketToProject(
          { ticketId: row.id, targetProjectId, adminUser: actorRef },
          { db: tx, publishEvent: false }
        );
        await applyAutoStatusTransitions(tx, row.id, actorRef);
      });
    } catch (err) {
      if (err instanceof TicketWorkflowError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus });
      }
      throw err;
    }
    publishTicketEvent({ type: "TICKET_UPDATED", ticketId: row.id, actorId: user.id }, targetProjectId, row.projectId);

    const updatedTicket = await getTicketById(row.id, true);

    if (!updatedTicket) {
      return NextResponse.json({ error: "Không tìm thấy ticket để điều phối" }, { status: 404 });
    }

    // Thông báo tới thành viên dự án đích có quyền tickets.view trong dự án đó
    if (targetProject) {
      const viewerIds = await getProjectTicketViewerIds(targetProject.id);
      for (const viewerId of viewerIds) {
        if (viewerId === user.id) continue;
        await sendNotification({
          userId: viewerId,
          actorId: user.id,
          type: "TICKET_CREATED",
          title: `🎫 Ticket mới được điều phối: ${updatedTicket.title}`,
          message: `${user.name} đã điều phối ticket "${updatedTicket.trackingCode}" từ khách hàng ${updatedTicket.customerName} tới dự án ${targetProject.name}.`,
          link: `/tickets?ticketId=${updatedTicket.id}`,
          projectId: targetProject.id,
        }).catch((e) => console.error("Lỗi gửi thông báo điều phối:", e));
      }
    }

    return NextResponse.json({
      success: true,
      ticket: { ...updatedTicket, capabilities: getTicketCapabilities(access, updatedTicket) },
      message: targetProject
        ? `Đã điều phối thành công ticket tới dự án ${targetProject.name}`
        : "Đã bỏ gán dự án, ticket trở về hàng chờ điều phối",
    });
  } catch (error) {
    return ticketRouteError(error, "Lỗi khi điều phối ticket:", "Lỗi hệ thống khi điều phối ticket");
  }
}
