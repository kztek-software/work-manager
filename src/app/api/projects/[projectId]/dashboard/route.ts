import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { STATUSES, PRIORITIES, TASK_TYPES } from "@/lib/constants";
import type { ProjectDashboardData } from "@/lib/types";

function safeIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
  }
  try {
    const d = new Date(val as string | number);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function safeIsoStringOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  try {
    const d = new Date(val as string | number);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getSessionUser(_req);
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { projectId } = await params;

    // Resolve target project by ID or Key, with graceful fallback to user's first project
    let matchedProject = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { key: projectId },
        ],
      },
      select: { id: true },
    });

    if (!matchedProject) {
      matchedProject = await prisma.project.findFirst({
        where: user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
    }

    const targetProjectId = matchedProject ? matchedProject.id : projectId;

    // Compute date boundaries before queries (used in WHERE clauses)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Single parallel batch — all independent queries run concurrently ──────────
    // Replaces: prisma.task.findMany (ALL tasks) + prisma.customerTicket.findMany (ALL tickets)
    // With: targeted groupBy / count aggregates + minimal findMany (take:8) for the display list
    const [
      currentMember,
      project,
      sprints,
      activities,
      // [OPTIMIZED] Task counts + story points grouped by status
      taskGroupByStatus,
      // [OPTIMIZED] Task counts grouped by priority
      taskGroupByPriority,
      // [OPTIMIZED] Task counts grouped by type
      taskGroupByType,
      // [OPTIMIZED] Overdue task count (DB-side, no JS loop)
      overdueCount,
      // [OPTIMIZED] Urgent non-done task count (DB-side)
      urgentCount,
      // [OPTIMIZED] Per-member per-status counts + story points (for workload table)
      taskGroupByAssigneeStatus,
      // [OPTIMIZED] Per-member overdue count (DB-side)
      overdueGroupByAssignee,
      // [OPTIMIZED] Urgent/overdue task list — minimal select + take:8 (was: slice from full list)
      urgentAndOverdueList,
      // [OPTIMIZED] Sprint task stats grouped by sprintId+status (avoids extra query after sprint lookup)
      sprintTaskGroupByStatus,
      // [OPTIMIZED] Ticket counts by status (replaces full ticket findMany)
      ticketGroupByStatus,
    ] = await Promise.all([
      // Auth check
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: targetProjectId, userId: user.id } },
      }),

      // Project info with members (needed for workload + team breakdown)
      prisma.project.findUnique({
        where: { id: targetProjectId },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
          attachments: {
            include: {
              uploader: { select: { id: true, name: true, avatarColor: true, title: true } },
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
                  role: true,
                  team: { select: { id: true, name: true, code: true, color: true } },
                },
              },
            },
            orderBy: { role: "asc" },
          },
        },
      }),

      // Sprint list (needed for active sprint identification)
      prisma.sprint.findMany({
        where: { projectId: targetProjectId },
        orderBy: { createdAt: "desc" },
      }),

      // Recent activities — already limited to 12
      prisma.activity.findMany({
        where: { task: { projectId: targetProjectId } },
        include: {
          actor: { select: { id: true, name: true, avatarColor: true } },
          task: { select: { id: true, number: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),

      // Task counts + story points per status
      prisma.task.groupBy({
        by: ["status"],
        where: { projectId: targetProjectId },
        _count: { _all: true },
        _sum: { storyPoints: true },
      }),

      // Task counts per priority
      prisma.task.groupBy({
        by: ["priority"],
        where: { projectId: targetProjectId },
        _count: { _all: true },
      }),

      // Task counts per type
      prisma.task.groupBy({
        by: ["type"],
        where: { projectId: targetProjectId },
        _count: { _all: true },
      }),

      // Overdue task count — direct DB count, no JS loop needed
      prisma.task.count({
        where: { projectId: targetProjectId, status: { not: "DONE" }, dueDate: { lt: startOfToday } },
      }),

      // Urgent non-done task count — direct DB count
      prisma.task.count({
        where: { projectId: targetProjectId, priority: "URGENT", status: { not: "DONE" } },
      }),

      // Per-member per-status task counts + story points
      // assigneeId=null rows (unassigned tasks) are intentionally skipped in post-processing
      prisma.task.groupBy({
        by: ["assigneeId", "status"],
        where: { projectId: targetProjectId },
        _count: { _all: true },
        _sum: { storyPoints: true },
      }),

      // Per-member overdue count
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: { projectId: targetProjectId, status: { not: "DONE" }, dueDate: { lt: startOfToday } },
        _count: { _all: true },
      }),

      // Urgent/overdue task list for display — minimal field select, capped at 8 rows
      // Avoids loading ALL tasks then slicing (was: urgentAndOverdueList.slice(0, 8))
      prisma.task.findMany({
        where: {
          projectId: targetProjectId,
          status: { not: "DONE" },
          OR: [{ dueDate: { lt: startOfToday } }, { priority: "URGENT" }],
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          dueDate: true,
          storyPoints: true,
          assignee: {
            select: { id: true, name: true, email: true, avatarColor: true, title: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),

      // Sprint task counts + story points grouped by sprint+status
      // Covers all sprints in one query; filtered to active sprint in post-processing
      prisma.task.groupBy({
        by: ["sprintId", "status"],
        where: { projectId: targetProjectId, sprintId: { not: null } },
        _count: { _all: true },
        _sum: { storyPoints: true },
      }),

      // Ticket counts by status — replaces full customerTicket.findMany
      prisma.customerTicket.groupBy({
        by: ["status"],
        where: { projectId: targetProjectId },
        _count: { _all: true },
      }),
    ]);

    if (!currentMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền truy cập dự án này" }, { status: 403 });
    }

    if (!project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    // ── 1. Summary — derived from taskGroupByStatus ───────────────────────────────
    const statusCountMap: Record<string, number> = {};
    const storyPointsByStatus: Record<string, number> = {};
    let totalTasks = 0;

    for (const row of taskGroupByStatus) {
      statusCountMap[row.status] = row._count._all;
      storyPointsByStatus[row.status] = row._sum.storyPoints ?? 0;
      totalTasks += row._count._all;
    }

    const doneTasks = statusCountMap["DONE"] ?? 0;
    const inProgressTasks = statusCountMap["IN_PROGRESS"] ?? 0;
    const inReviewTasks = statusCountMap["IN_REVIEW"] ?? 0;
    const todoTasks = statusCountMap["TODO"] ?? 0;
    const backlogTasks = statusCountMap["BACKLOG"] ?? 0;

    const totalStoryPoints = Object.values(storyPointsByStatus).reduce((sum, v) => sum + v, 0);
    const doneStoryPoints = storyPointsByStatus["DONE"] ?? 0;
    const remainingStoryPoints = Math.max(0, totalStoryPoints - doneStoryPoints);
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const pointsCompletionRate = totalStoryPoints > 0 ? Math.round((doneStoryPoints / totalStoryPoints) * 100) : 0;

    // ── 2. Status Distribution ────────────────────────────────────────────────────
    const statusDistribution = STATUSES.map((s) => ({
      status: s.id,
      label: s.label,
      count: statusCountMap[s.id] ?? 0,
      color: s.color,
    }));

    // ── 3. Priority Distribution ──────────────────────────────────────────────────
    const priorityCountMap: Record<string, number> = {};
    for (const row of taskGroupByPriority) {
      priorityCountMap[row.priority] = row._count._all;
    }
    const priorityDistribution = PRIORITIES.map((p) => ({
      priority: p.id,
      label: p.label,
      count: priorityCountMap[p.id] ?? 0,
      color: p.color,
    }));

    // ── 4. Type Distribution ──────────────────────────────────────────────────────
    const typeCountMap: Record<string, number> = {};
    for (const row of taskGroupByType) {
      typeCountMap[row.type] = row._count._all;
    }
    const typeDistribution = TASK_TYPES.map((t) => ({
      type: t.id,
      label: t.label,
      count: typeCountMap[t.id] ?? 0,
      color: t.color,
    }));

    // ── 5. Active Sprint — stats from sprintTaskGroupByStatus ─────────────────────
    const rawActiveSprint = sprints.find((s) => s.status === "ACTIVE") || null;
    let activeSprintDto: ProjectDashboardData["activeSprint"] = null;

    if (rawActiveSprint) {
      let sprintTotalTasks = 0;
      let sprintDoneTasks = 0;
      let sprintTotalPts = 0;
      let sprintDonePts = 0;

      // Look up this sprint's rows in the already-computed groupBy result
      for (const row of sprintTaskGroupByStatus) {
        if (row.sprintId !== rawActiveSprint.id) continue;
        sprintTotalTasks += row._count._all;
        sprintTotalPts += row._sum.storyPoints ?? 0;
        if (row.status === "DONE") {
          sprintDoneTasks += row._count._all;
          sprintDonePts += row._sum.storyPoints ?? 0;
        }
      }

      let daysRemaining: number | null = null;
      if (rawActiveSprint.endDate) {
        const end = new Date(rawActiveSprint.endDate).getTime();
        if (!isNaN(end)) {
          const diffDays = Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
          daysRemaining = Math.max(0, diffDays);
        }
      }

      activeSprintDto = {
        id: rawActiveSprint.id,
        name: rawActiveSprint.name,
        goal: rawActiveSprint.goal,
        status: rawActiveSprint.status,
        startDate: safeIsoStringOrNull(rawActiveSprint.startDate),
        endDate: safeIsoStringOrNull(rawActiveSprint.endDate),
        daysRemaining,
        totalTasks: sprintTotalTasks,
        doneTasks: sprintDoneTasks,
        totalPoints: sprintTotalPts,
        donePoints: sprintDonePts,
      };
    }

    // ── 6. Member Workloads — derived from taskGroupByAssigneeStatus ──────────────
    // Build lookup: assigneeId → { [status]: { count, storyPoints } }
    type AssigneeStatusEntry = { count: number; storyPoints: number };
    const assigneeStatusMap = new Map<string, Record<string, AssigneeStatusEntry>>();

    for (const row of taskGroupByAssigneeStatus) {
      if (!row.assigneeId) continue; // Skip unassigned tasks
      if (!assigneeStatusMap.has(row.assigneeId)) {
        assigneeStatusMap.set(row.assigneeId, {});
      }
      assigneeStatusMap.get(row.assigneeId)![row.status] = {
        count: row._count._all,
        storyPoints: row._sum.storyPoints ?? 0,
      };
    }

    // Build overdue lookup: assigneeId → overdue count
    const overdueByAssigneeMap = new Map<string, number>();
    for (const row of overdueGroupByAssignee) {
      if (!row.assigneeId) continue;
      overdueByAssigneeMap.set(row.assigneeId, row._count._all);
    }

    const memberWorkloads = project.members.map((m) => {
      const statusEntries = assigneeStatusMap.get(m.user.id) ?? {};

      let totalMemberTasks = 0;
      let doneMemberTasks = 0;
      let inProgMemberTasks = 0;
      let memberStoryPoints = 0;

      for (const [status, entry] of Object.entries(statusEntries)) {
        totalMemberTasks += entry.count;
        memberStoryPoints += entry.storyPoints;
        if (status === "DONE") doneMemberTasks += entry.count;
        if (status === "IN_PROGRESS" || status === "IN_REVIEW") inProgMemberTasks += entry.count;
      }

      const overdueMemberTasks = overdueByAssigneeMap.get(m.user.id) ?? 0;
      const rate = totalMemberTasks > 0 ? Math.round((doneMemberTasks / totalMemberTasks) * 100) : 0;

      return {
        userId: m.user.id,
        name: m.user.name,
        avatarColor: m.user.avatarColor,
        title: m.user.title,
        role: m.role,
        teamName: m.user.team?.name || null,
        teamColor: m.user.team?.color || null,
        totalTasks: totalMemberTasks,
        doneTasks: doneMemberTasks,
        inProgressTasks: inProgMemberTasks,
        overdueTasks: overdueMemberTasks,
        storyPoints: memberStoryPoints,
        completionRate: rate,
      };
    });

    // ── 7. Team Breakdown — derived from memberWorkloads (no extra query) ──────────
    const teamMap = new Map<
      string,
      { id: string; name: string; code: string; color: string; memberCount: number; totalTasks: number; doneTasks: number }
    >();

    for (const m of project.members) {
      if (!m.user.team) continue;
      const t = m.user.team;
      if (!teamMap.has(t.id)) {
        teamMap.set(t.id, { id: t.id, name: t.name, code: t.code, color: t.color, memberCount: 0, totalTasks: 0, doneTasks: 0 });
      }
      const entry = teamMap.get(t.id)!;
      entry.memberCount++;

      const wl = memberWorkloads.find((w) => w.userId === m.user.id);
      if (wl) {
        entry.totalTasks += wl.totalTasks;
        entry.doneTasks += wl.doneTasks;
      }
    }
    const teamBreakdown = Array.from(teamMap.values());

    // ── 8. Urgent & Overdue Task List ─────────────────────────────────────────────
    const urgentAndOverdueTasks: ProjectDashboardData["urgentAndOverdueTasks"] =
      urgentAndOverdueList.map((t) => {
        const isOverdue = !!t.dueDate && new Date(t.dueDate) < startOfToday;
        return {
          id: t.id,
          number: t.number,
          title: t.title,
          status: t.status,
          priority: t.priority,
          type: t.type,
          dueDate: safeIsoStringOrNull(t.dueDate),
          isOverdue,
          assignee: t.assignee,
          storyPoints: t.storyPoints,
        };
      });

    // ── 9. Ticket Stats — derived from ticketGroupByStatus ────────────────────────
    const ticketStatusCountMap: Record<string, number> = {};
    let totalTickets = 0;
    for (const row of ticketGroupByStatus) {
      ticketStatusCountMap[row.status] = row._count._all;
      totalTickets += row._count._all;
    }
    // Luồng trạng thái ticket: src/lib/ticket-status.ts
    const openTickets = ticketStatusCountMap["OPEN"] ?? 0;
    const acknowledgedTickets = ticketStatusCountMap["ACKNOWLEDGED"] ?? 0;
    const triagedTickets = ticketStatusCountMap["TRIAGED"] ?? 0;
    const inProgressTickets = ticketStatusCountMap["IN_PROGRESS"] ?? 0;
    const closedTickets = ticketStatusCountMap["CLOSED"] ?? 0;
    const cancelledTickets = ticketStatusCountMap["CANCELLED"] ?? 0;
    // Tỉ lệ giải quyết = Đã đóng / (Tổng - Đã hủy): ticket Đã hủy không phải "đã xử lý xong",
    // nên loại khỏi cả tử lẫn mẫu (số Đã hủy vẫn trả riêng trong ticketStats.cancelled)
    const resolvableTickets = totalTickets - cancelledTickets;
    const ticketResolutionRate =
      resolvableTickets > 0 ? Math.round((closedTickets / resolvableTickets) * 100) : 0;

    // ── 10. Assemble response — shape identical to previous version ───────────────
    const dashboardData: ProjectDashboardData = {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        status: project.status || "PLANNING",
        ownerId: project.ownerId,
        owner: project.owner,
        createdAt: safeIsoString(project.createdAt),
        updatedAt: safeIsoString(project.updatedAt),
        attachments: (project.attachments || []).map((att) => ({
          id: att.id,
          projectId: att.projectId,
          taskId: att.taskId,
          ticketId: att.ticketId,
          uploaderId: att.uploaderId,
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileType: att.fileType,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          createdAt: safeIsoString(att.createdAt),
          uploader: att.uploader
            ? {
                id: att.uploader.id,
                name: att.uploader.name,
                avatarColor: att.uploader.avatarColor,
                title: att.uploader.title,
              }
            : null,
        })),
        members: project.members.map((m) => ({
          id: m.id,
          role: m.role,
          user: m.user,
        })),
      },
      currentRole: currentMember?.role || (user.role === "ADMIN" ? "ADMIN" : "VIEWER"),
      summary: {
        totalTasks,
        doneTasks,
        inProgressTasks,
        inReviewTasks,
        todoTasks,
        backlogTasks,
        overdueTasks: overdueCount,
        urgentTasks: urgentCount,
        completionRate,
        totalStoryPoints,
        doneStoryPoints,
        remainingStoryPoints,
        pointsCompletionRate,
      },
      activeSprint: activeSprintDto,
      statusDistribution,
      priorityDistribution,
      typeDistribution,
      memberWorkloads,
      teamBreakdown,
      urgentAndOverdueTasks,
      recentActivities: activities.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        createdAt: safeIsoString(a.createdAt),
        actor: a.actor,
        task: a.task,
      })),
      ticketStats: {
        total: totalTickets,
        open: openTickets,
        acknowledged: acknowledgedTickets,
        triaged: triagedTickets,
        inProgress: inProgressTickets,
        closed: closedTickets,
        cancelled: cancelledTickets,
        resolutionRate: ticketResolutionRate,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Error in GET /api/projects/[projectId]/dashboard:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tạo Dashboard", details: String(error) },
      { status: 500 }
    );
  }
}
