import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import { notifyTaskAssigned } from "@/lib/notifications";
import { addTicketComment, getTicketById, publishTicketEvent } from "@/lib/tickets";
import { isTicketFinal, TICKET_FINAL_STATUSES } from "@/lib/ticket-status";
import {
  findAccessibleTicket,
  getTicketAccess,
  getTicketCapabilities,
  ticketRouteError,
} from "@/lib/ticket-access";

const convertSchema = z.object({
  sprintId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  customTitle: z.string().optional(),
});

const UNASSIGNED_ERROR = "Ticket chưa được gán dự án. Cần người có quyền điều phối gán dự án trước khi chuyển thành task.";
const CONVERT_FORBIDDEN_ERROR = "Bạn không có quyền chuyển ticket thành task (Yêu cầu quyền: tickets.convert)";

// Ném trong transaction khi ticket đã được người khác chuyển đổi đồng thời -> rollback task vừa tạo
class TicketAlreadyConvertedError extends Error {}

// GET /api/tickets/[ticketId]/convert -> Dữ liệu cho form chuyển đổi: sprint & thành viên của dự án đã gán
export async function GET(
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
    if (!row.projectId) {
      return NextResponse.json({ error: UNASSIGNED_ERROR }, { status: 400 });
    }
    if (!getTicketCapabilities(access, row).canConvert) {
      return NextResponse.json({ error: CONVERT_FORBIDDEN_ERROR }, { status: 403 });
    }

    const [project, sprints, members] = await Promise.all([
      prisma.project.findUnique({
        where: { id: row.projectId },
        select: { id: true, name: true, key: true },
      }),
      prisma.sprint.findMany({
        where: { projectId: row.projectId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, goal: true, status: true, startDate: true, endDate: true },
      }),
      prisma.projectMember.findMany({
        where: { projectId: row.projectId },
        include: { user: { select: { id: true, name: true, avatarColor: true, title: true } } },
      }),
    ]);

    return NextResponse.json({
      project,
      sprints: sprints.map((s) => ({
        ...s,
        startDate: s.startDate ? s.startDate.toISOString() : null,
        endDate: s.endDate ? s.endDate.toISOString() : null,
      })),
      members: members.map((m) => ({ id: m.id, role: m.role, user: m.user })),
    });
  } catch (error) {
    return ticketRouteError(error, "Lỗi tải dữ liệu chuyển đổi ticket:");
  }
}

// POST /api/tickets/[ticketId]/convert -> Tạo task trong dự án ĐÃ GÁN của ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { ticketId: ticketParam } = await params;

    const access = await getTicketAccess(user);
    const row = await findAccessibleTicket(access, ticketParam);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }
    if (!row.projectId) {
      return NextResponse.json({ error: UNASSIGNED_ERROR }, { status: 400 });
    }
    if (isTicketFinal(row.status)) {
      return NextResponse.json({ error: "Ticket đã đóng / hủy, không thể chuyển thành task" }, { status: 409 });
    }
    if (!getTicketCapabilities(access, row).canConvert) {
      return NextResponse.json({ error: CONVERT_FORBIDDEN_ERROR }, { status: 403 });
    }

    const projectId = row.projectId;
    const ticketId = row.id;
    const ticket = await getTicketById(ticketId, true);
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }

    // Nếu đã chuyển đổi trước đó
    if (ticket.convertedTaskId) {
      const existingTask = await prisma.task.findUnique({
        where: { id: ticket.convertedTaskId },
        select: { id: true, number: true, title: true, status: true },
      });
      if (existingTask) {
        return NextResponse.json(
          { error: `Ticket này đã được chuyển đổi thành task #${existingTask.number}` },
          { status: 400 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const parsed = convertSchema.safeParse(body);
    const d = parsed.success ? parsed.data : { status: "TODO" as const };

    // Sprint / người phụ trách phải thuộc đúng dự án của ticket
    if ("sprintId" in d && d.sprintId) {
      const sprint = await prisma.sprint.findFirst({ where: { id: d.sprintId, projectId }, select: { id: true } });
      if (!sprint) {
        return NextResponse.json({ error: "Sprint không thuộc dự án của ticket" }, { status: 400 });
      }
    }
    if ("assigneeId" in d && d.assigneeId) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: d.assigneeId } },
        select: { id: true },
      });
      if (!member) {
        return NextResponse.json({ error: "Người phụ trách không phải thành viên dự án của ticket" }, { status: 400 });
      }
    }

    let task;
    try {
      task = await prisma.$transaction(async (tx) => {
        // Tìm hoặc tạo nhãn "Báo lỗi KH"
        let customerLabel = await tx.label.findFirst({
          where: { projectId, name: "Báo lỗi KH" },
        });
        if (!customerLabel) {
          customerLabel = await tx.label.create({
            data: {
              projectId,
              name: "Báo lỗi KH",
              color: "#F05922",
            },
          });
        }

        // Lấy số thứ tự task tiếp theo
        const lastTask = await tx.task.findFirst({
          where: { projectId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const taskNumber = (lastTask?.number ?? 0) + 1;

        // Lấy vị trí cột
        const maxPos = await tx.task.aggregate({
          where: { projectId, status: d.status },
          _max: { position: true },
        });

        const taskTitle = d.customTitle?.trim() || `[${ticket.trackingCode}] ${ticket.title}`;
    
        let detailedDescription = `### 🎫 Nguồn: Báo lỗi từ khách hàng (${ticket.trackingCode})\n`;
        detailedDescription += `- **Khách hàng:** ${ticket.customerName} (${ticket.customerEmail}${ticket.customerPhone ? ` - ${ticket.customerPhone}` : ""})\n`;
        if (ticket.customerCompany) detailedDescription += `- **Đơn vị/Công ty:** ${ticket.customerCompany}\n`;
        if (ticket.environment) detailedDescription += `- **Môi trường/Thiết bị:** ${ticket.environment}\n`;
        detailedDescription += `\n---\n\n### 📝 Chi tiết sự cố:\n${ticket.description}`;

        // Tạo Task mới loại BUG trên Kanban Board
        const task = await tx.task.create({
          data: {
            projectId,
            number: taskNumber,
            title: taskTitle,
            description: detailedDescription,
            type: "BUG",
            status: d.status,
            priority: d.priority || ticket.priority || "MEDIUM",
            assigneeId: d.assigneeId || null,
            sprintId: d.sprintId || null,
            creatorId: user.id,
            position: (maxPos._max.position ?? 0) + 1000,
            labels: {
              create: [{ labelId: customerLabel.id }],
            },
            activity: {
              create: {
                actorId: user.id,
                action: "CREATED",
                detail: `đã chuyển đổi từ Ticket ${ticket.trackingCode}`,
              },
            },
          },
          include: {
            assignee: { select: { id: true, name: true, avatarColor: true } },
            labels: { include: { label: true } },
          },
        });

        // Sao chép toàn bộ attachments của ticket sang task mới
        if (ticket.attachments && ticket.attachments.length > 0) {
          await tx.attachment.createMany({
            data: ticket.attachments.map((att) => ({
              taskId: task.id,
              fileName: att.fileName,
              fileUrl: att.fileUrl,
              fileType: att.fileType,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              uploaderId: user.id,
            })),
          });
        }

        // Gắn task vào ticket CÓ ĐIỀU KIỆN: convertedTaskId & dự án vẫn như lúc kiểm tra (null hoặc trỏ task
        // đã bị xóa). Request khác chuyển đổi/điều phối đồng thời -> không cập nhật được dòng nào -> rollback
        // toàn bộ (kể cả task vừa tạo)
        const claimed = await tx.customerTicket.updateMany({
          // Convert CHỈ liên kết task: không đổi người xử lý / trạng thái ticket (theo luồng trạng thái).
          // Ticket bị đóng / hủy / điều phối đồng thời -> không khớp -> rollback.
          where: {
            id: ticketId,
            convertedTaskId: ticket.convertedTaskId ?? null,
            projectId,
            status: { notIn: [...TICKET_FINAL_STATUSES] },
          },
          data: { convertedTaskId: task.id },
        });
        if (claimed.count === 0) throw new TicketAlreadyConvertedError();

        await addTicketComment(
          {
            ticketId,
            authorName: user.name,
            isStaff: true,
            isInternalOnly: true,
            message: `[Chuyển task] ${user.name} đã chuyển ticket thành task #${task.number}.`,
            actorId: user.id,
          },
          { db: tx, publishEvent: false }
        );

        return task;
      });
    } catch (err) {
      if (err instanceof TicketAlreadyConvertedError) {
        return NextResponse.json(
          { error: "Ticket vừa được người khác chuyển đổi hoặc cập nhật. Vui lòng tải lại và thử lại." },
          { status: 409 }
        );
      }
      throw err;
    }

    // Bắn realtime event (Board dự án + module Ticket)
    publish(projectId, {
      type: "TASK_CREATED",
      taskId: task.id,
      actorId: user.id,
    });
    publishTicketEvent({ type: "TICKET_UPDATED", ticketId, actorId: user.id }, projectId);

    // Gửi thông báo & Email giao việc nếu có gán người
    if (task.assigneeId) {
      notifyTaskAssigned({
        taskId: task.id,
        assigneeId: task.assigneeId,
        actorId: user.id,
        projectId,
      });
    }

    const updatedTicket = await getTicketById(ticketId, true);

    return NextResponse.json({
      success: true,
      task,
      ticket: updatedTicket && { ...updatedTicket, capabilities: getTicketCapabilities(access, updatedTicket) },
    }, { status: 201 });
  } catch (error) {
    return ticketRouteError(error, "Lỗi khi chuyển đổi ticket sang task:", "Lỗi máy chủ khi chuyển đổi");
  }
}
