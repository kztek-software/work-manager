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
  ChevronsUpDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { STATUSES, PRIORITIES, projectStatusMeta } from "@/lib/constants";
import { PriorityIcon } from "@/components/board/priority-icon";
import { TypeIcon } from "@/components/board/type-icon";
import { cn } from "@/lib/utils";
import { useTabCache, mutateTabCache } from "@/lib/tab-cache";
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
  // Filters
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("ALL");
  const [groupBy, setGroupBy] = useState<"project" | "status" | "none">("project");

  // Dialog
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Universal SWR Cache - Tải tức thì 0ms từ RAM Cache, không bị block màn hình loading
  const {
    data,
    loading,
    isValidating,
    revalidate: refreshMyWork,
    mutate: mutateMyWork,
  } = useTabCache<MyWorkData>(
    "/api/my-work",
    async () => {
      const res = await fetch("/api/my-work");
      if (!res.ok) throw new Error("Không thể tải danh sách công việc");
      return res.json();
    },
    {
      staleTime: 12000,
    }
  );

  // Quick toggle done status (Optimistic Update)
  const toggleTaskStatus = async (task: TaskDto, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === "DONE" ? "IN_PROGRESS" : "DONE";

    // Optimistic update directly in SWR RAM cache
    mutateMyWork((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === "DONE" ? new Date().toISOString() : null,
            }
          : t
      );
      const done = updatedTasks.filter((t) => t.status === "DONE").length;
      return {
        ...prev,
        tasks: updatedTasks,
        stats: {
          ...prev.stats,
          done,
          inProgress: updatedTasks.filter((t) => t.status === "IN_PROGRESS").length,
          todo: updatedTasks.filter((t) => t.status === "TODO" || t.status === "BACKLOG").length,
        },
      };
    });

    try {
      await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      refreshMyWork();
    } catch {
      refreshMyWork();
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
    filteredTasks.forEach((task) => {
      if (!map.has(task.projectId)) {
        map.set(task.projectId, { project: task.project, tasks: [] });
      }
      map.get(task.projectId)!.tasks.push(task);
    });
    return map;
  }, [filteredTasks]);

  // Collapsible Project Cards State (remember in localStorage)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("kztek_mywork_collapsed_projects");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = { ...prev, [projectId]: !prev[projectId] };
      try {
        localStorage.setItem("kztek_mywork_collapsed_projects", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const allAreCollapsed = useMemo(() => {
    if (tasksByProject.size === 0) return false;
    for (const id of tasksByProject.keys()) {
      if (!collapsedProjects[id]) return false;
    }
    return true;
  }, [tasksByProject, collapsedProjects]);

  const toggleAllProjects = () => {
    if (allAreCollapsed) {
      setCollapsedProjects({});
      try {
        localStorage.setItem("kztek_mywork_collapsed_projects", JSON.stringify({}));
      } catch {}
    } else {
      const all: Record<string, boolean> = {};
      for (const id of tasksByProject.keys()) {
        all[id] = true;
      }
      setCollapsedProjects(all);
      try {
        localStorage.setItem("kztek_mywork_collapsed_projects", JSON.stringify(all));
      } catch {}
    }
  };

  // Currently open task
  const activeOpenTask = useMemo(() => {
    if (!openTaskId || !data) return null;
    return data.tasks.find((t) => t.id === openTaskId) || null;
  }, [openTaskId, data]);

  const stats = data?.stats || {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
    overdue: 0,
    dueToday: 0,
  };

  const isFirstLoad = loading && !data;

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
                  {isFirstLoad ? "..." : `${stats.total} nhiệm vụ`}
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
            onClick={() => refreshMyWork()}
            disabled={isValidating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-foreground transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-accent", isValidating && "animate-spin")} />
            <span>{isValidating ? "Đang đồng bộ..." : "Làm mới"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards (Lazy loaded with smooth Skeleton pulse if first load) */}
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
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-foreground font-mono">{stats.total}</div>
          )}
        </button>

        {/* Card: Cần làm */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("TODO")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "TODO"
              ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-blue-500 text-xs font-semibold">
            <span>Cần làm</span>
            <Clock className="h-4 w-4" />
          </div>
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-blue-500 font-mono">{stats.todo}</div>
          )}
        </button>

        {/* Card: Đang thực hiện */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("IN_PROGRESS")}
          className={cn(
            "flex flex-col rounded-2xl border p-3.5 text-left transition-all cursor-pointer shadow-xs",
            selectedStatusFilter === "IN_PROGRESS"
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
              : "border-line bg-surface hover:bg-surface-2"
          )}
        >
          <div className="flex items-center justify-between text-amber-500 text-xs font-semibold">
            <span>Đang làm</span>
            <RefreshCw className="h-4 w-4" />
          </div>
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-amber-500 font-mono">{stats.inProgress}</div>
          )}
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
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-rose-500 font-mono">{stats.overdue}</div>
          )}
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
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-orange-500 font-mono">{stats.dueToday}</div>
          )}
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
          {isFirstLoad ? (
            <div className="mt-2 h-7 w-12 rounded-lg bg-surface-3 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-black text-emerald-500 font-mono">{stats.done}</div>
          )}
        </button>
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3.5 rounded-2xl border border-line shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          {/* Search Box - Using standard SearchInput */}
          <div className="min-w-[280px] flex-1 max-w-xl">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Tìm theo tên task, mã task, dự án, người liên hệ..."
              size="md"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted shrink-0">Dự án:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent font-semibold transition-colors shadow-2xs"
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted shrink-0">Ưu tiên:</span>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent font-semibold transition-colors shadow-2xs"
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

        {/* Group By selector & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-line/60">
          <span className="text-xs font-bold text-muted">Bố cục:</span>
          <div className="flex h-10 items-center rounded-xl border border-line bg-surface-2 p-1 text-xs">
            <button
              type="button"
              onClick={() => setGroupBy("project")}
              className={cn(
                "h-8 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center",
                groupBy === "project" ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground"
              )}
            >
              Theo Dự Án
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("none")}
              className={cn(
                "h-8 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center",
                groupBy === "none" ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground"
              )}
            >
              Danh Sách Phẳng
            </button>
          </div>

          {/* Quick Expand / Collapse All Projects Button */}
          {groupBy === "project" && tasksByProject.size > 1 && (
            <button
              type="button"
              onClick={toggleAllProjects}
              className="h-10 px-3 rounded-xl border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-muted hover:text-foreground transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title={allAreCollapsed ? "Mở rộng tất cả các nhóm dự án" : "Thu gọn tất cả các nhóm dự án"}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline">{allAreCollapsed ? "Mở rộng hết" : "Thu gọn hết"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Content List - Progressive Instant Skeleton when first loading */}
      {isFirstLoad ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((idx) => (
            <div key={idx} className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
              <div className="flex items-center justify-between p-4 bg-surface-2/60 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surface-3" />
                  <div className="h-4 w-40 rounded bg-surface-3" />
                  <div className="h-4 w-12 rounded bg-surface-3" />
                </div>
                <div className="h-3 w-28 rounded bg-surface-3" />
              </div>
              <div className="divide-y divide-line/60 p-1">
                {[1, 2, 3].map((rowIdx) => (
                  <div key={rowIdx} className="flex items-center justify-between p-3 gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-4 w-4 rounded bg-surface-3" />
                      <div className="h-4 w-16 rounded bg-surface-3" />
                      <div className="h-4 w-48 rounded bg-surface-3" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-24 rounded bg-surface-3" />
                      <div className="h-5 w-20 rounded bg-surface-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
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
              className="mt-4 px-3.5 py-1.5 rounded-xl border border-line bg-surface-2 text-xs font-semibold text-foreground hover:bg-surface-3 transition-colors cursor-pointer"
            >
              Xóa toàn bộ bộ lọc
            </button>
          )}
        </div>
      ) : groupBy === "project" ? (
        // ================= GROUPED BY PROJECT =================
        <div className="space-y-4">
          {Array.from(tasksByProject.values()).map(({ project, tasks }) => {
            const doneCount = tasks.filter((t) => t.status === "DONE").length;
            const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
            const pStatusMeta = projectStatusMeta(project.status);
            const isCollapsed = !!collapsedProjects[project.id];

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs space-y-0 transition-all"
              >
                {/* Project Header Bar - Cho phép thu nhỏ / mở rộng */}
                <div
                  onClick={() => toggleProjectCollapse(project.id)}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-4 bg-surface-2/60 transition-colors cursor-pointer select-none group/header hover:bg-surface-2",
                    !isCollapsed && "border-b border-line"
                  )}
                  title={isCollapsed ? "Bấm để mở rộng danh sách công việc" : "Bấm để thu gọn danh sách công việc"}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted shrink-0 transition-transform duration-200 group-hover/header:text-foreground",
                        isCollapsed ? "-rotate-90 text-muted/60" : "text-foreground"
                      )}
                    />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#251C53] to-[#F05922] font-mono font-black text-xs text-white shadow-sm">
                      {project.key.slice(0, 3)}
                    </div>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate group-hover/header:text-accent transition-colors">
                        {project.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-accent shrink-0">{project.key}</span>
                      <a
                        href={`/board?projects=${project.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof document !== "undefined") {
                            document.cookie = `flowboard_active_project=${project.id}; path=/; max-age=2592000; SameSite=Lax`;
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-line text-[10.5px] font-semibold text-muted hover:text-accent hover:border-accent transition-all shadow-2xs ml-1"
                        title={`Mở Board dự án ${project.name}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden sm:inline">Mở Board</span>
                      </a>
                    </div>
                  </div>

                  {/* Right Meta Group: Status, Task Count & Progress — Cố định kích thước các cột */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto">
                    {/* Project Status Badge — Cố định độ rộng 110px */}
                    <div className="w-[110px] shrink-0 flex items-center justify-center">
                      <span
                        className="w-full text-center px-2 py-0.5 rounded text-[10px] font-bold select-none truncate"
                        style={{
                          backgroundColor: pStatusMeta.bg,
                          color: pStatusMeta.color,
                          border: `1px solid ${pStatusMeta.border}`,
                        }}
                      >
                        {pStatusMeta.label}
                      </span>
                    </div>

                    {/* Task Count Pill — Cố định độ rộng 68px */}
                    <div className="w-[68px] shrink-0 flex items-center justify-center">
                      <span className="w-full text-center px-1.5 py-0.5 rounded-full bg-surface-3 text-muted text-[10px] font-bold border border-line select-none">
                        {tasks.length} việc
                      </span>
                    </div>

                    {/* Project Progress */}
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-muted shrink-0 min-w-[150px] justify-end">
                      <span className="whitespace-nowrap">
                        Tiến độ: <strong className="text-foreground">{doneCount}/{tasks.length}</strong> ({progress}%)
                      </span>
                      <div className="w-20 sm:w-24 h-2 rounded-full bg-surface-3 overflow-hidden border border-line shrink-0">
                        <div
                          className={cn("h-full transition-all duration-300", progress === 100 ? "bg-emerald-500" : "bg-accent")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tasks in Project */}
                {!isCollapsed && (
                  <div className="divide-y divide-line/60 animate-in fade-in-50 duration-150">
                    {tasks.map((task) => (
                      <TaskItemRow
                        key={task.id}
                        task={task}
                        onToggleDone={(e) => toggleTaskStatus(task, e)}
                        onOpenDetail={() => setOpenTaskId(task.id)}
                      />
                    ))}
                  </div>
                )}
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
            refreshMyWork();
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

      {/* Right Column: Metadata Badges (Checklist, Due Date, Contact, Status) */}
      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto text-xs">
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

        {/* Contact Person Column - Cố định kích thước chuẩn */}
        <div className="w-[125px] sm:w-[145px] shrink-0 flex items-center justify-end">
          {task.contactName || task.contactPhone ? (
            <span
              className="w-full flex items-center gap-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10.5px] font-semibold shadow-2xs"
              title={`Người liên hệ: ${task.contactName || ""} ${task.contactPhone ? `(${task.contactPhone})` : ""}`}
            >
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1 text-left">{task.contactName || task.contactPhone}</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted/30 italic hidden sm:inline-block pr-2 select-none">—</span>
          )}
        </div>

        {/* Status Badge - Cố định kích thước 100% thẳng hàng */}
        <div className="w-[96px] sm:w-[105px] shrink-0 flex justify-end">
          <span
            className="w-full h-[22px] px-1.5 flex items-center justify-center rounded-lg text-[10.5px] font-bold border truncate text-center shadow-2xs"
            style={{
              backgroundColor: `${currentStatusObj.color}18`,
              color: currentStatusObj.color,
              borderColor: `${currentStatusObj.color}35`,
            }}
            title={currentStatusObj.label}
          >
            {currentStatusObj.label}
          </span>
        </div>
      </div>
    </div>
  );
}
