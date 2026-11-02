"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CheckSquare,
  Square,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Phone,
  User,
  ArrowUpDown,
  RefreshCw,
  Layers,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { STATUSES, PRIORITIES, projectStatusMeta } from "@/lib/constants";
import { PriorityIcon } from "@/components/board/priority-icon";
import { TypeIcon } from "@/components/board/type-icon";
import { cn } from "@/lib/utils";
import type { TaskDto, ProjectDto, MemberDto, LabelDto, SprintDto } from "@/lib/types";

const TaskDialog = dynamic(() => import("@/components/board/task-dialog").then((m) => m.TaskDialog), {
  ssr: false,
});

interface MyWorkData {
  tasks: (TaskDto & { project: ProjectDto })[];
  projects: ProjectDto[];
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    overdue: number;
    dueToday: number;
  };
}

export function MyWorkView({ userId }: { userId: string }) {
  const [data, setData] = useState<MyWorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("ALL");
  const [groupBy, setGroupBy] = useState<"project" | "status" | "none">("project");

  // Dialog
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const fetchMyWork = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/my-work");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Lỗi tải công việc của tôi:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMyWork();
  }, [fetchMyWork]);

  // Quick toggle done status
  const toggleTaskStatus = async (task: TaskDto, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === "DONE" ? "IN_PROGRESS" : "DONE";

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id ? { ...t, status: nextStatus, completedAt: nextStatus === "DONE" ? new Date().toISOString() : null } : t
      );
      return { ...prev, tasks: updatedTasks };
    });

    try {
      await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchMyWork(true);
    } catch {
      fetchMyWork();
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((task) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesKey = `${task.project.key}-${task.number}`.toLowerCase().includes(q);
        const matchesProject = task.project.name.toLowerCase().includes(q);
        const matchesContact = (task.contactName || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesKey && !matchesProject && !matchesContact) return false;
      }

      // Project filter
      if (selectedProjectId !== "ALL" && task.projectId !== selectedProjectId) {
        return false;
      }

      // Priority filter
      if (selectedPriorityFilter !== "ALL" && task.priority !== selectedPriorityFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter === "TODO") {
        if (task.status !== "TODO" && task.status !== "BACKLOG") return false;
      } else if (selectedStatusFilter === "IN_PROGRESS") {
        if (task.status !== "IN_PROGRESS") return false;
      } else if (selectedStatusFilter === "IN_REVIEW") {
        if (task.status !== "IN_REVIEW") return false;
      } else if (selectedStatusFilter === "DONE") {
        if (task.status !== "DONE") return false;
      } else if (selectedStatusFilter === "OVERDUE") {
        if (!task.dueDate || task.status === "DONE") return false;
        if (!isBefore(new Date(task.dueDate), startOfDay(new Date()))) return false;
      } else if (selectedStatusFilter === "DUE_TODAY") {
        if (!task.dueDate || task.status === "DONE") return false;
        if (!isToday(new Date(task.dueDate))) return false;
      }

      return true;
    });
  }, [data, search, selectedProjectId, selectedStatusFilter, selectedPriorityFilter]);

  // Grouped tasks by Project
  const tasksByProject = useMemo(() => {
    const map = new Map<string, { project: ProjectDto; tasks: typeof filteredTasks }>();
    for (const t of filteredTasks) {
      if (!map.has(t.projectId)) {
        map.set(t.projectId, { project: t.project, tasks: [] });
      }
      map.get(t.projectId)!.tasks.push(t);
    }
    return Array.from(map.values());
  }, [filteredTasks]);

  // Currently open task
  const activeOpenTask = useMemo(() => {
    if (!openTaskId || !data) return null;
    return data.tasks.find((t) => t.id === openTaskId) || null;
  }, [openTaskId, data]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-muted text-sm gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-accent" />
        <span>Đang tổng hợp công việc của bạn...</span>
      </div>
    );
  }

  const stats = data?.stats || {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
    overdue: 0,
    dueToday: 0,
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-md shadow-accent/25">
              <CheckSquare className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Việc Của Tôi
                <span className="text-xs font-bold text-accent bg-accent/15 px-2 py-0.5 rounded-full">
                  {stats.total} nhiệm vụ
                </span>
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Tổng hợp toàn bộ công việc và nhiệm vụ được giao cho bạn trên tất cả các dự án
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => fetchMyWork(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-foreground transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-accent", refreshing && "animate-spin")} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card: Tổng việc */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("ALL")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "ALL"
              ? "border-accent bg-accent/10 ring-1 ring-accent/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-muted text-xs font-semibold">
            <span>Tổng việc</span>
            <Layers className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground font-mono">{stats.total}</div>
        </button>

        {/* Card: Đang thực hiện */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("IN_PROGRESS")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "IN_PROGRESS"
              ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-amber-500 text-xs font-semibold">
            <span>Đang làm</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500 font-mono">{stats.inProgress}</div>
        </button>

        {/* Card: Cần làm */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("TODO")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "TODO"
              ? "border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-blue-500 text-xs font-semibold">
            <span>Cần làm</span>
            <Square className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-500 font-mono">{stats.todo}</div>
        </button>

        {/* Card: Quá hạn */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("OVERDUE")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "OVERDUE"
              ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-rose-500 text-xs font-semibold">
            <span>Quá hạn</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-500 font-mono">{stats.overdue}</div>
        </button>

        {/* Card: Hôm nay */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("DUE_TODAY")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "DUE_TODAY"
              ? "border-orange-500 bg-orange-500/15 ring-1 ring-orange-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-orange-500 text-xs font-semibold">
            <span>Đến hạn hôm nay</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-orange-500 font-mono">{stats.dueToday}</div>
        </button>

        {/* Card: Hoàn thành */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("DONE")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "DONE"
              ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-emerald-500 text-xs font-semibold">
            <span>Đã xong</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500 font-mono">{stats.done}</div>
        </button>
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-line shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Tìm theo tên task, mã task, dự án, người liên hệ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8.5 rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted shrink-0">Dự án:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-8.5 rounded-xl border border-line bg-surface-2 px-2.5 text-xs text-foreground focus:outline-none focus:border-accent font-semibold"
            >
              <option value="ALL">Tất cả dự án ({data?.projects.length || 0})</option>
              {data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted shrink-0">Ưu tiên:</span>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-line bg-surface-2 px-2.5 text-xs text-foreground focus:outline-none focus:border-accent font-semibold"
            >
              <option value="ALL">Tất cả mức ưu tiên</option>
              {PRIORITIES.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Group By selector */}
        <div className="flex items-center gap-1.5 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-line/60">
          <span className="text-[11px] font-semibold text-muted">Bố cục:</span>
          <div className="flex rounded-xl border border-line bg-surface-2 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setGroupBy("project")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                groupBy === "project" ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground"
              )}
            >
              Theo Dự Án
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("none")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                groupBy === "none" ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground"
              )}
            >
              Danh Sách Phẳng
            </button>
          </div>
        </div>
      </div>

      {/* Task Content List */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-surface rounded-2xl border border-line border-dashed min-h-[280px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-3">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Không có công việc nào cần làm!</h3>
          <p className="text-xs text-muted max-w-sm mt-1">
            Tuyệt vời! Bạn đã xử lý xong toàn bộ công việc hoặc bộ lọc hiện tại không khớp với nhiệm vụ nào.
          </p>
          {(search || selectedProjectId !== "ALL" || selectedStatusFilter !== "ALL" || selectedPriorityFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedProjectId("ALL");
                setSelectedStatusFilter("ALL");
                setSelectedPriorityFilter("ALL");
              }}
              className="mt-4 px-3 py-1.5 text-xs font-bold text-accent bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors"
            >
              Xóa các bộ lọc
            </button>
          )}
        </div>
      ) : groupBy === "project" ? (
        // ================= GROUPED BY PROJECT =================
        <div className="space-y-6">
          {tasksByProject.map(({ project, tasks }) => {
            const doneCount = tasks.filter((t) => t.status === "DONE").length;
            const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
            const pStatusMeta = projectStatusMeta(project.status);

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs space-y-0"
              >
                {/* Project Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-4 bg-surface-2/60 border-b border-line">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#251C53] to-[#F05922] font-mono font-black text-xs text-white shadow-sm">
                      {project.key.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">{project.name}</span>
                        <span className="text-xs font-mono font-bold text-accent">{project.key}</span>
                        <span
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                          style={{
                            backgroundColor: pStatusMeta.bg,
                            color: pStatusMeta.color,
                            border: `1px solid ${pStatusMeta.border}`,
                          }}
                        >
                          {pStatusMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Project Progress */}
                  <div className="flex items-center gap-3 text-xs font-semibold text-muted">
                    <span>
                      Tiến độ: <strong className="text-foreground">{doneCount}/{tasks.length}</strong> ({progress}%)
                    </span>
                    <div className="w-24 h-2 rounded-full bg-surface-3 overflow-hidden border border-line">
                      <div
                        className={cn("h-full transition-all duration-300", progress === 100 ? "bg-emerald-500" : "bg-accent")}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tasks in Project */}
                <div className="divide-y divide-line/60">
                  {tasks.map((task) => (
                    <TaskItemRow
                      key={task.id}
                      task={task}
                      onToggleDone={(e) => toggleTaskStatus(task, e)}
                      onOpenDetail={() => setOpenTaskId(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ================= FLAT LIST =================
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs divide-y divide-line/60">
          {filteredTasks.map((task) => (
            <TaskItemRow
              key={task.id}
              task={task}
              showProjectBadge={true}
              onToggleDone={(e) => toggleTaskStatus(task, e)}
              onOpenDetail={() => setOpenTaskId(task.id)}
            />
          ))}
        </div>
      )}

      {/* Task Dialog Modal */}
      {activeOpenTask && (
        <TaskDialog
          projectId={activeOpenTask.projectId}
          projectName={activeOpenTask.project.name}
          taskId={activeOpenTask.id}
          tasks={data?.tasks || []}
          members={[]}
          labels={activeOpenTask.labels?.map((l) => l.label) || []}
          sprints={[]}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => {
            fetchMyWork(true);
          }}
        />
      )}
    </div>
  );
}

/**
 * Single Task Row Item component for MyWork view
 */
function TaskItemRow({
  task,
  showProjectBadge = false,
  onToggleDone,
  onOpenDetail,
}: {
  task: TaskDto & { project: ProjectDto };
  showProjectBadge?: boolean;
  onToggleDone: (e: React.MouseEvent) => void;
  onOpenDetail: () => void;
}) {
  const isDone = task.status === "DONE";
  const isOverdue =
    task.dueDate && !isDone && isBefore(new Date(task.dueDate), startOfDay(new Date()));
  const isDueToday = task.dueDate && !isDone && isToday(new Date(task.dueDate));
  const doneSubtasks = task.subtasks?.filter((s) => s.done).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  const currentStatusObj = STATUSES.find((s) => s.id === task.status) || STATUSES[0];

  return (
    <div
      onClick={onOpenDetail}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-3 hover:bg-surface-2/80 transition-colors cursor-pointer group",
        isDone && "bg-surface-2/30 opacity-75"
      )}
    >
      {/* Left Column: Checkbox, Icons, Key & Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Checkbox Quick Toggle */}
        <button
          type="button"
          onClick={onToggleDone}
          className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0 border border-line-strong hover:border-accent hover:bg-accent/15 transition-all text-muted cursor-pointer"
          title={isDone ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
        >
          {isDone ? (
            <CheckSquare className="h-4 w-4 text-emerald-500 fill-emerald-500/20" />
          ) : (
            <Square className="h-4 w-4 group-hover:text-accent" />
          )}
        </button>

        {/* Priority & Type icons */}
        <div className="flex items-center gap-1 shrink-0">
          <PriorityIcon priority={task.priority} />
          <TypeIcon type={task.type} />
        </div>

        {/* Task Key */}
        <span className="font-mono text-xs font-black text-accent shrink-0">
          {task.project.key}-{task.number}
        </span>

        {/* Optional Project Badge if Flat View */}
        {showProjectBadge && (
          <span className="text-[10px] font-bold text-muted bg-surface-3 px-1.5 py-0.5 rounded border border-line shrink-0">
            {task.project.name}
          </span>
        )}

        {/* Task Title */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "text-xs font-bold block truncate transition-colors group-hover:text-accent",
              isDone ? "text-muted line-through" : "text-foreground"
            )}
            title={task.title}
          >
            {task.title}
          </span>
        </div>
      </div>

      {/* Right Column: Metadata Badges (Contact, Checklist, Due Date, Status) */}
      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto text-xs">
        {/* Contact Person Badge */}
        {(task.contactName || task.contactPhone) && (
          <span
            className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10.5px] font-semibold"
            title={`Người liên hệ: ${task.contactName || ""} ${task.contactPhone ? `(${task.contactPhone})` : ""}`}
          >
            <Phone className="h-3 w-3" />
            <span className="max-w-[90px] truncate">{task.contactName || task.contactPhone}</span>
          </span>
        )}

        {/* Checklist Progress */}
        {totalSubtasks > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-line px-2 py-0.5 text-[10.5px] font-semibold text-muted">
            <CheckSquare className="h-3 w-3" />
            <span>{doneSubtasks}/{totalSubtasks}</span>
          </span>
        )}

        {/* Due Date Indicator */}
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-semibold border",
              isOverdue
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold"
                : isDueToday
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 font-bold"
                : "bg-surface-2 text-muted border-line"
            )}
          >
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {isOverdue ? "Quá hạn: " : isDueToday ? "Hôm nay: " : ""}
            {format(new Date(task.dueDate), "dd/MM")}
          </span>
        )}

        {/* Status Badge */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-bold border"
          style={{
            backgroundColor: `${currentStatusObj.color}18`,
            color: currentStatusObj.color,
            borderColor: `${currentStatusObj.color}35`,
          }}
        >
          {currentStatusObj.label}
        </span>
      </div>
    </div>
  );
}
