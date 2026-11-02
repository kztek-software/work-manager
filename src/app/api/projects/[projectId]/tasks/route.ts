import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import { canCreateTask } from "@/lib/permissions";
import { notifyTaskAssigned } from "@/lib/notifications";
import { checkUserPermission } from "@/lib/permissions-server";

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarColor: true } },
  labels: { include: { label: true } },
  subtasks: true,
  attachments: true,
  _count: { select: { comments: true } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser(_req);
  const { projectId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member && user.role !== "ADMIN") return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  const [project, tasks, sprints, labels, members] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.task.findMany({
      where: { projectId },
      include: taskInclude,
      orderBy: { position: "asc" },
    }),
    prisma.sprint.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.label.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.projectMember.findMany({
      where: { projectId },
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
    }),
  ]);

  if (!project) return NextResponse.json({ error: "Không tìm thấy project" }, { status: 404 });

  return NextResponse.json({
    project,
    tasks,
    sprints,
    labels,
    members,
    currentRole: member?.role ?? (user.role === "ADMIN" ? "OWNER" : "MEMBER"),
  });
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(["TASK", "STORY", "BUG", "EPIC"]).default("TASK"),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  subtasks: z
    .union([
      z.array(z.string()),
      z.array(z.object({ title: z.string() })),
    ])
    .optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileType: z.string().optional().default("other"),
        fileSize: z.number().nullable().optional(),
        mimeType: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  const { projectId } = await params;

  const permCheck = await checkUserPermission(user.id, "tasks.create", projectId, user.role);
  if (!permCheck.allowed) {
    return NextResponse.json({ error: permCheck.reason || "Bạn không có quyền tạo công việc mới" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu task không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;

  // Chạy song song 2 query độc lập để lấy số thứ tự và vị trí task mới
  const [lastTask, maxPos] = await Promise.all([
    prisma.task.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    }),
    prisma.task.aggregate({
      where: { projectId, status: d.status },
      _max: { position: true },
    }),
  ]);

  const task = await prisma.task.create({
    data: {
      projectId,
      number: (lastTask?.number ?? 0) + 1,
      title: d.title,
      description: d.description,
      type: d.type,
      status: d.status,
      priority: d.priority,
      storyPoints: d.storyPoints ?? null,
      assigneeId: d.assigneeId,
      creatorId: user.id,
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      sprintId: d.sprintId,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      position: (maxPos._max.position ?? 0) + 1000,
      completedAt: d.status === "DONE" ? new Date() : null,
      labels: d.labelIds?.length
        ? { create: d.labelIds.map((labelId) => ({ labelId })) }
        : undefined,
      subtasks: d.subtasks?.length
        ? {
            create: d.subtasks.map((item) =>
              typeof item === "string" ? { title: item } : { title: item.title }
            ),
          }
        : undefined,
      attachments: d.attachments?.length
        ? {
            create: d.attachments.map((att) => ({
              fileName: att.fileName,
              fileUrl: att.fileUrl,
              fileType: att.fileType || "other",
              fileSize: att.fileSize ?? null,
              mimeType: att.mimeType ?? null,
              projectId,
              uploaderId: user.id,
            })),
          }
        : undefined,
      activity: { create: { actorId: user.id, action: "CREATED", detail: "đã tạo task này" } },
    },
    include: taskInclude,
  });

  publish(projectId, { type: "TASK_CREATED", taskId: task.id, actorId: user.id });

  // Gửi thông báo & Email giao việc nếu có người nhận
  if (task.assigneeId) {
    notifyTaskAssigned({
      taskId: task.id,
      assigneeId: task.assigneeId,
      actorId: user.id,
      projectId,
    });
  }

  return NextResponse.json({ task }, { status: 201 });
}
