import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTicketById,
  updateTicket,
  addTicketComment,
  dispatchTicketToProject,
  publishTicketEvent,
} from "@/lib/tickets";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTicketActor,
  findAccessibleTicket,
  getTicketAccess,
  getTicketCapabilities,
  hasTicketPermission,
  ticketRouteError,
} from "@/lib/ticket-access";
import { notifyCustomerAboutTicket } from "@/lib/ticket-mail";
import { acknowledgeTicketOnView, applyAutoStatusTransitions } from "@/lib/ticket-workflow";
import {
  checkTicketAction,
  hasInlineDataUri,
  INLINE_DATA_URI_ERROR,
  isTicketFinal,
  TICKET_FINAL_STATUSES,
  TICKET_PRIORITY_LABELS,
  TicketWorkflowError,
} from "@/lib/ticket-status";

// GET /api/tickets/[ticketId] -> Chi tiết ticket cho nhân viên (id hoặc mã tra cứu).
// Khách hàng tra cứu qua /api/tickets/public/[trackingCode].
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

    // Nhân viên mở chi tiết lần đầu -> tự động Mới → Đã tiếp nhận
    if (row.status === "OPEN") {
      await acknowledgeTicketOnView(row.id, { id: user.id, name: user.name });
    }

    const ticket = await getTicketById(row.id, true);
    return NextResponse.json({
      ticket: ticket && { ...ticket, capabilities: getTicketCapabilities(access, ticket) },
    });
  } catch (error) {
    return ticketRouteError(error, "Lỗi khi tải ticket:");
  }
}

// PATCH chỉ cập nhật THÔNG TIN ticket. Trạng thái / người xử lý / Đóng-Hủy đi qua
// POST /api/tickets/[ticketId]/actions (server là nguồn sự thật của luồng trạng thái).
const updateTicketSchema = z.object({
  // Lưu mức ưu tiên = nhân viên xác nhận ưu tiên (kể cả khi giữ nguyên giá trị)
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  type: z.enum(["BUG", "SUPPORT", "INQUIRY", "FEATURE_REQ"]).optional(),
  internalNotes: z
    .string()
    .refine((v) => !hasInlineDataUri(v), { message: INLINE_DATA_URI_ERROR })
    .nullable()
    .optional(),
  // Đổi dự án (id) / bỏ gán (null tường minh) — bắt buộc quyền tickets.assign. Chuỗi rỗng không hợp lệ.
  projectId: z.string().min(1, "Mã dự án không hợp lệ").nullable().optional(),
  newComment: z
    .object({
      message: z.string().min(1).refine((v) => !hasInlineDataUri(v), { message: INLINE_DATA_URI_ERROR }),
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

    const access = await getTicketAccess(user);
    const row = await findAccessibleTicket(access, ticketId);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    // Không nhận đổi trạng thái tự do nữa (client cũ / app mobile cũ)
    if (body && typeof body === "object" && ("status" in body || "resolutionNotes" in body)) {
      return NextResponse.json(
        {
          error:
            "Không đổi trạng thái trực tiếp được nữa. Dùng các thao tác Bắt đầu xử lý / Đóng / Hủy / Mở lại (POST /api/tickets/[id]/actions).",
        },
        { status: 400 }
      );
    }
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const { newComment, projectId, priority, ...ticketUpdates } = parsed.data;
    const hasFieldUpdates = Object.values(ticketUpdates).some((v) => v !== undefined);
    const changesProject = projectId !== undefined && projectId !== row.projectId;
    const actor = buildTicketActor(access, row.projectId);

    // Kiểm tra quyền theo từng loại thao tác (theo dự án HIỆN TẠI của ticket)
    if (changesProject && !hasTicketPermission(access, "tickets.assign", row.projectId)) {
      return NextResponse.json(
        { error: "Bạn không có quyền gán / đổi dự án cho ticket (Yêu cầu quyền: tickets.assign)" },
        { status: 403 }
      );
    }
    if (changesProject && isTicketFinal(row.status)) {
      return NextResponse.json({ error: "Ticket đã đóng / hủy, không thể đổi dự án" }, { status: 409 });
    }
    if (priority !== undefined) {
      const check = checkTicketAction("confirm_priority", row, actor);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.httpStatus });
    }
    // Đổi thông tin / ghi chú / phản hồi: cần quyền xử lý ticket trong dự án của ticket
    if ((hasFieldUpdates || newComment) && !actor.canWrite) {
      return NextResponse.json(
        { error: "Bạn chỉ có quyền xem ticket này, không thể cập nhật hoặc phản hồi" },
        { status: 403 }
      );
    }

    if (changesProject && projectId) {
      const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ error: "Không tìm thấy dự án đích" }, { status: 404 });
      }
    }

    const actorRef = { id: user.id, name: user.name };

    // Điều phối + xác nhận ưu tiên + cập nhật trường + bình luận: 1 transaction, sau đó áp dụng chuyển
    // trạng thái tự động (vd: đủ ưu tiên + dự án -> Đã phân loại), phát realtime 1 lần sau khi commit
    try {
      await prisma.$transaction(async (tx) => {
        const writeOptions = { db: tx, publishEvent: false };
        if (changesProject) {
          await dispatchTicketToProject(
            {
              ticketId: row.id,
              targetProjectId: projectId ?? null,
              adminUser: actorRef,
            },
            writeOptions
          );
        }
        if (priority !== undefined) {
          // Kiểm tra lại trên dữ liệu đọc trong transaction + update có điều kiện "chưa kết thúc"
          const fresh = await tx.customerTicket.findUnique({
            where: { id: row.id },
            select: { status: true, projectId: true, assigneeId: true, acknowledgedAt: true, priorityConfirmedAt: true },
          });
          if (!fresh) throw new TicketWorkflowError(404, "Không tìm thấy ticket");
          const check = checkTicketAction("confirm_priority", fresh, buildTicketActor(access, fresh.projectId));
          if (!check.ok) throw new TicketWorkflowError(check.httpStatus, check.error);
          const updated = await tx.customerTicket.updateMany({
            where: { id: row.id, status: { notIn: [...TICKET_FINAL_STATUSES] } },
            data: { priority, priorityConfirmedAt: new Date(), priorityConfirmedById: user.id },
          });
          if (updated.count === 0) throw new TicketWorkflowError(409, "Ticket đã đóng / hủy, không thể đổi mức ưu tiên");
          await addTicketComment(
            {
              ticketId: row.id,
              authorName: user.name,
              isStaff: true,
              isInternalOnly: true,
              message: `[Phân loại] ${user.name} đã xác nhận mức ưu tiên: ${TICKET_PRIORITY_LABELS[priority] || priority}.`,
              actorId: user.id,
            },
            writeOptions
          );
        }
        if (hasFieldUpdates) {
          await updateTicket(row.id, ticketUpdates, user.id, writeOptions);
        }
        if (newComment) {
          await addTicketComment(
            {
              ticketId: row.id,
              authorName: user.name,
              authorEmail: user.email,
              isStaff: true,
              isInternalOnly: newComment.isInternalOnly,
              message: newComment.message,
              actorId: user.id,
            },
            writeOptions
          );
        }
        if (changesProject || priority !== undefined) {
          await applyAutoStatusTransitions(tx, row.id, actorRef);
        }
      });
    } catch (err) {
      if (err instanceof TicketWorkflowError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus });
      }
      throw err;
    }

    if (changesProject || priority !== undefined || hasFieldUpdates || newComment) {
      const finalProjectId = changesProject ? projectId ?? null : row.projectId;
      publishTicketEvent(
        { type: "TICKET_UPDATED", ticketId: row.id, actorId: user.id },
        finalProjectId,
        changesProject ? row.projectId : null
      );
    }

    const updatedTicket = await getTicketById(row.id, true);

    // Phản hồi công khai mới -> email cho khách (bình luận nội bộ KHÔNG gửi).
    // Email KẾT QUẢ gửi khi Đóng / Hủy qua /actions.
    if (newComment && !newComment.isInternalOnly) {
      notifyCustomerAboutTicket({ ticketId: row.id, kind: "REPLY", replyHtml: newComment.message, staffName: user.name });
    }
    return NextResponse.json({
      success: true,
      ticket: updatedTicket && {
        ...updatedTicket,
        capabilities: getTicketCapabilities(access, updatedTicket),
      },
    });
  } catch (error) {
    return ticketRouteError(error, "Lỗi cập nhật ticket:");
  }
}
