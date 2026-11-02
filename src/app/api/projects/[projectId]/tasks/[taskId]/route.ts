import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import { statusMeta } from "@/lib/constants";
import { canEditTask, canDeleteTask } from "@/lib/permissions";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/notifications";

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarColor: true } },
  labels: { include: { label: true } },
  subtasks: true,
  attachments: true,
  _count: { select: { comments: true } },
} as const;

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  type: z.enum(["TASK", "STORY", "BUG", "EPIC"]).optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  position: z.number().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const user = await requireUser();
  const { projectId, taskId } = await params;

  const [member, task] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    }),
    prisma.task.findFirst({ where: { id: taskId, projectId } }),
  ]);

  if (!member && user.role !== "ADMIN") return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  if (member && !canEditTask(member.role)) {
    return NextResponse.json({ error: "Người xem (Viewer) không có quyền chỉnh sửa task" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;

  const activityEntries: { actorId: string; action: string; detail: string }[] = [];

  if (d.status && d.status !== task.status) {
    activityEntries.push({
      actorId: user.id,
      action: "STATUS_CHANGED",
      detail: `chuyển trạng thái từ ${statusMeta(task.status).label} sang ${statusMeta(d.status).label}`,
    });
  }
  if (d.assigneeId !== undefined && d.assigneeId !== task.assigneeId) {
    const assignee = d.assigneeId
      ? await prisma.user.findUnique({ where: { id: d.assigneeId }, select: { name: true } })
      : null;
    activityEntries.push({
      actorId: user.id,
      action: "ASSIGNED",
      detail: assignee ? `giao task cho ${assignee.name}` : "bỏ assignee",
    });
  }
  if (d.title || d.description !== undefined || d.priority || d.storyPoints !== undefined) {
    activityEntries.push({ actorId: user.id, action: "UPDATED", detail: "đã cập nhật task" });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: d.title,
      description: d.description,
      type: d.type,
      status: d.status,
      priority: d.priority,
      storyPoints: d.storyPoints,
      assigneeId: d.assigneeId,
      sprintId: d.sprintId,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      dueDate: d.dueDate === undefined ? undefined : d.dueDate ? new Date(d.dueDate) : null,
      position: d.position,
      completedAt:
        d.status === "DONE" && task.status !== "DONE"
          ? new Date()
          : d.status && d.status !== "DONE"
            ? null
            : undefined,
      ...(d.labelIds
        ? { labels: { deleteMany: {}, create: d.labelIds.map((labelId) => ({ labelId })) } }
        : {}),
      ...(activityEntries.length ? { activity: { create: activityEntries } } : {}),
    },
    include: taskInclude,
  });

  publish(projectId, { type: "TASK_CHANGED", taskId, actorId: user.id });

  // Gửi thông báo & Email nếu có phân công người mới
  if (d.assigneeId && d.assigneeId !== task.assigneeId) {
    notifyTaskAssigned({
      taskId,
      assigneeId: d.assigneeId,
      actorId: user.id,
      projectId,
    });
  } else if (d.status && d.status !== task.status) {
    // Thông báo và email cập nhật tiến độ công việc
    notifyTaskStatusChanged({
      taskId,
      actorId: user.id,
      oldStatus: task.status,
      newStatus: d.status,
      projectId,
    });
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const user = await requireUser();
  const { projectId, taskId } = await params;

  const [member, task] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    }),
    prisma.task.findFirst({ where: { id: taskId, projectId } }),
  ]);

  if (!member && user.role !== "ADMIN") return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  if (member && !canDeleteTask(member.role) && user.role !== "ADMIN" && task.creatorId !== user.id) {
    return NextResponse.json({ error: "Bạn không có quyền xóa task này (chỉ Admin/Owner hoặc Người tạo)" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: taskId } });
  publish(projectId, { type: "TASK_DELETED", taskId, actorId: user.id });
  return NextResponse.json({ ok: true });
}
