import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // Lấy các dự án user có quyền truy cập
  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? undefined : { members: { some: { userId: user.id } } },
    select: { id: true, name: true, key: true, status: true },
    orderBy: { name: "asc" },
  });

  const accessibleProjectIds = projects.map((p) => p.id);
  const isAdmin = user.role === "ADMIN";

  // Lấy toàn bộ công việc được giao cho user trong các dự án đó
  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: accessibleProjectIds },
      assigneeId: user.id,
    },
    include: {
      project: { select: { id: true, name: true, key: true, status: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
      labels: { include: { label: true } },
      subtasks: { orderBy: { id: "asc" } },
      attachments: true,
      customerTicket: {
        select: {
          id: true,
          trackingCode: true,
          customerName: true,
          customerEmail: true,
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: [
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  // Đối với Quản trị viên: lấy thêm danh sách công việc chưa được phân công để điều phối
  const unassignedTasks = isAdmin
    ? await prisma.task.findMany({
        where: {
          projectId: { in: accessibleProjectIds },
          assigneeId: null,
        },
        include: {
          project: { select: { id: true, name: true, key: true, status: true } },
          assignee: { select: { id: true, name: true, avatarColor: true } },
          labels: { include: { label: true } },
          subtasks: { orderBy: { id: "asc" } },
          attachments: true,
          customerTicket: {
            select: {
              id: true,
              trackingCode: true,
              customerName: true,
              customerEmail: true,
            },
          },
          _count: { select: { comments: true } },
        },
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
      })
    : [];

  // Danh sách nhân sự các dự án để phân công nhanh
  const projectMembers = isAdmin
    ? await prisma.projectMember.findMany({
        where: { projectId: { in: accessibleProjectIds } },
        select: {
          projectId: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarColor: true,
              title: true,
            },
          },
        },
      })
    : [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let todoCount = 0;
  let inProgressCount = 0;
  let inReviewCount = 0;
  let doneCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;

  for (const t of tasks) {
    if (t.status === "DONE") {
      doneCount++;
    } else {
      if (t.status === "IN_PROGRESS") inProgressCount++;
      else if (t.status === "IN_REVIEW") inReviewCount++;
      else todoCount++;

      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (d < todayStart) overdueCount++;
        else if (d >= todayStart && d <= todayEnd) dueTodayCount++;
      }
    }
  }

  return NextResponse.json({
    tasks,
    unassignedTasks,
    projectMembers: projectMembers.map((m) => ({ projectId: m.projectId, user: m.user })),
    isAdmin,
    projects,
    stats: {
      total: tasks.length,
      todo: todoCount,
      inProgress: inProgressCount,
      inReview: inReviewCount,
      done: doneCount,
      overdue: overdueCount,
      dueToday: dueTodayCount,
      unassigned: unassignedTasks.length,
    },
  });
}
