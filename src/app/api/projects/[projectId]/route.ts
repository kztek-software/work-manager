import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageMembers } from "@/lib/permissions";
import { checkUserPermission } from "@/lib/permissions-server";
import { publishTicketEvent } from "@/lib/tickets";
import { computeAutoStatus } from "@/lib/ticket-status";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { key: projectId }] },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarColor: true,
                title: true,
                team: { select: { id: true, name: true, code: true, color: true } },
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
            sprints: true,
            customerTickets: true,
            attachments: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const currentMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });

    if (!currentMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền truy cập dự án này" }, { status: 403 });
    }

    return NextResponse.json({
      project,
      currentRole: currentMember?.role || (user.role === "ADMIN" ? "ADMIN" : "VIEWER"),
    });
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/projects/[projectId] error:", err);
    return NextResponse.json({ error: "Lỗi tải thông tin dự án" }, { status: 500 });
  }
}

const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  key: z.string().min(2).max(6).regex(/^[A-Z][A-Z0-9]*$/, "Key phải viết hoa, bắt đầu bằng chữ").optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  ownerId: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { projectId } = await params;

    // Tìm dự án theo ID hoặc Key
    const existingProject = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { key: projectId }] },
    });
    if (!existingProject) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    const resolvedProjectId = existingProject.id;

    const permCheck = await checkUserPermission(user.id, "projects.edit", resolvedProjectId, user.role);
    if (!permCheck.allowed) {
      return NextResponse.json({ error: permCheck.reason || "Không có quyền chỉnh sửa dự án này" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dữ liệu cập nhật không hợp lệ" },
        { status: 400 }
      );
    }

    const { name, key, description, status, ownerId } = parsed.data;

    // Kiểm tra trùng Key nếu có thay đổi key
    if (key) {
      const existing = await prisma.project.findFirst({
        where: { key, NOT: { id: resolvedProjectId } },
      });
      if (existing) {
        return NextResponse.json({ error: `Mã Key "${key}" đã tồn tại trên dự án khác` }, { status: 409 });
      }
    }

    // Nếu chuyển giao Owner
    if (ownerId) {
      const targetUser = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!targetUser) {
        return NextResponse.json({ error: "Người dùng được chọn làm Chủ dự án không tồn tại" }, { status: 400 });
      }

      // Đảm bảo user mới có mặt trong projectMembers với role OWNER
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: resolvedProjectId, userId: ownerId } },
        update: { role: "OWNER" },
        create: { projectId: resolvedProjectId, userId: ownerId, role: "OWNER" },
      });
    }

    const updatedProject = await prisma.project.update({
      where: { id: resolvedProjectId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(key ? { key: key.trim().toUpperCase() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(status ? { status } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
        _count: { select: { tasks: true, members: true, customerTickets: true } },
      },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/projects/[projectId] error:", err);
    return NextResponse.json({ error: err.message || "Lỗi cập nhật dự án" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { key: projectId }] },
      select: { id: true, name: true, key: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const resolvedProjectId = project.id;

    const permCheck = await checkUserPermission(user.id, "projects.delete", resolvedProjectId, user.role);
    if (!permCheck.allowed) {
      return NextResponse.json({ error: permCheck.reason || "Chỉ Chủ dự án hoặc Quản trị viên mới có thể xóa dự án này" }, { status: 403 });
    }

    // Ticket bị bỏ gán / gỡ task — phát realtime sau khi transaction commit
    let affectedTickets: { id: string; prevProjectId: string | null }[] = [];

    // Xóa toàn bộ dữ liệu phụ thuộc một cách an toàn và triệt để trong Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Tìm tất cả task IDs trong project
      const tasks = await tx.task.findMany({
        where: { projectId: resolvedProjectId },
        select: { id: true },
      });
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length > 0) {
        await tx.subtask.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.activity.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskLabel.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.attachment.deleteMany({ where: { taskId: { in: taskIds } } });
      }

      // 2. Ticket khách hàng là module riêng: KHÔNG xóa ticket / comment / attachment của ticket.
      //    Bỏ gán dự án để ticket quay lại hàng chờ điều phối; gỡ liên kết task đã convert (task sắp bị xóa,
      //    FK convertedTaskId là NoAction nên phải gỡ trước khi xóa task).
      const tickets = await tx.customerTicket.findMany({
        where: {
          OR: [
            { projectId: resolvedProjectId },
            ...(taskIds.length > 0 ? [{ convertedTaskId: { in: taskIds } }] : []),
          ],
        },
        select: { id: true, projectId: true, status: true, acknowledgedAt: true, priorityConfirmedAt: true },
      });

      for (const t of tickets) {
        const inThisProject = t.projectId === resolvedProjectId;
        // Ticket của dự án bị xóa: bỏ dự án + người xử lý; trạng thái đang xử lý dở lùi theo luồng
        // (Đã phân loại / Đang xử lý -> Đã tiếp nhận). Ticket đã Đóng / Hủy giữ nguyên.
        const nextStatus = inThisProject
          ? computeAutoStatus({ ...t, projectId: null, assigneeId: null }).status
          : t.status;
        await tx.customerTicket.update({
          where: { id: t.id },
          data: {
            convertedTaskId: null,
            ...(inThisProject ? { projectId: null, assigneeId: null, status: nextStatus } : {}),
          },
        });
      }

      const unassignedTicketIds = tickets.filter((t) => t.projectId === resolvedProjectId).map((t) => t.id);
      if (unassignedTicketIds.length > 0) {
        await tx.ticketComment.createMany({
          data: unassignedTicketIds.map((ticketId) => ({
            ticketId,
            authorName: user.name,
            isStaff: true,
            isInternalOnly: true,
            message: `[Điều phối hệ thống] Dự án ${project.name} (${project.key}) đã bị xóa — ticket được bỏ gán dự án và chờ điều phối lại.`,
          })),
        });
      }
      affectedTickets = tickets.map((t) => ({ id: t.id, prevProjectId: t.projectId }));

      // 3. Xóa các thực thể cấp dự án (giữ nguyên attachment gắn với ticket)
      await tx.attachment.deleteMany({ where: { projectId: resolvedProjectId, ticketId: null } });
      await tx.task.deleteMany({ where: { projectId: resolvedProjectId } });
      await tx.sprint.deleteMany({ where: { projectId: resolvedProjectId } });
      await tx.label.deleteMany({ where: { projectId: resolvedProjectId } });
      await tx.projectMember.deleteMany({ where: { projectId: resolvedProjectId } });

      // 4. Xóa chính Project
      await tx.project.delete({ where: { id: resolvedProjectId } });
    });

    for (const t of affectedTickets) {
      publishTicketEvent(
        { type: "TICKET_UPDATED", ticketId: t.id, actorId: user.id },
        t.prevProjectId === resolvedProjectId ? null : t.prevProjectId,
        t.prevProjectId === resolvedProjectId ? resolvedProjectId : null
      );
    }

    return NextResponse.json({ ok: true, message: `Đã xóa vĩnh viễn dự án ${project.name}` });
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/projects/[projectId] error:", err);
    return NextResponse.json({ error: err.message || "Lỗi xóa dự án" }, { status: 500 });
  }
}

