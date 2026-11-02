"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  Rocket,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Flame,
  ArrowRight,
} from "lucide-react";
import type { SprintDto, TaskDto, MemberDto, LabelDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "primereact/dialog";
import { SprintDetailDialog } from "@/components/sprint/sprint-detail-dialog";
import { TaskDialog } from "@/components/board/task-dialog";
import { useTabCache } from "@/lib/tab-cache";

export default function SprintsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const tasksApiUrl = projectId ? `/api/projects/${projectId}/tasks` : null;

  const fetchTasks = useCallback(async () => {
    if (!projectId) throw new Error("No project ID");
    const headers: Record<string, string> = {};
    try {
      const token = localStorage.getItem("flowboard_session");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}

    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      credentials: "same-origin",
      headers,
    });
    if (!res.ok) throw new Error("Failed to load sprints data");
    return await res.json();
  }, [projectId]);

  const {
    data: tabData,
    loading,
    mutate: setTabData,
    revalidate: load,
  } = useTabCache<{
    sprints?: SprintDto[];
    tasks?: TaskDto[];
    labels?: LabelDto[];
    members?: MemberDto[];
    project?: { name: string; key: string };
  }>(tasksApiUrl, fetchTasks, {
    staleTime: 15000,
  });

  const sprints = tabData?.sprints || [];
  const tasks = tabData?.tasks || [];
  const labels = tabData?.labels || [];
  const members = tabData?.members || [];
  const projectName = tabData?.project?.name || "Dự án";
  const projectKey = tabData?.project?.key || "TASK";

  // Selected Sprint for Detail Inspector
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  // Task Dialog for direct inspection
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Create Sprint Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không tạo được sprint");
        return;
      }
      setCreateOpen(false);
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      await load();
      if (data.sprint?.id) {
        setSelectedSprintId(data.sprint.id);
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSprintStatus(sprintId: string, status: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    // Optimistic update tức thì trên UI (< 1ms)
    if (setTabData) {
      setTabData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sprints: (prev.sprints || []).map((s) => (s.id === sprintId ? { ...s, status: status as any } : s)),
        };
      });
    }
    try {
      await fetch(`/api/projects/${projectId}/sprints/${sprintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      alert("Lỗi cập nhật sprint");
      load();
    }
  }

  function sprintStats(sprintId: string) {
    const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);
    const total = sprintTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const done = sprintTasks
      .filter((t) => t.status === "DONE")
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const doneCount = sprintTasks.filter((t) => t.status === "DONE").length;
    return { count: sprintTasks.length, doneCount, total, done };
  }

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  if (loading && !tabData) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-background animate-pulse p-4 sm:p-5 space-y-4">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pb-2">
          <div className="h-6 w-36 bg-surface-2 rounded-lg" />
          <div className="h-8 w-28 bg-surface-2 rounded-xl" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-28 bg-surface-2 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-3" />
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 sm:px-5 bg-surface/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="hidden sm:inline">Dự án</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted/60 hidden sm:inline" />
            <span className="text-foreground font-bold truncate max-w-[120px] sm:max-w-none">{projectName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
            <span className="text-accent font-bold">Sprints</span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="h-8 px-3 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25"
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Sprint mới</span>
          <span className="sm:hidden">Tạo</span>
        </Button>
      </div>

      {/* Main Sprints List */}
      <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto p-3 sm:p-5 max-w-5xl mx-auto w-full">
        {sprints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 sm:py-20 text-center rounded-2xl border border-dashed border-line bg-surface/30 px-4">
            <div className="h-12 w-12 rounded-2xl bg-surface-2 flex items-center justify-center text-muted">
              <Rocket className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Chưa có sprint nào trong dự án</p>
              <p className="text-xs text-muted mt-0.5">Tạo sprint mới để phân bổ công việc theo chu kỳ 1-2 tuần</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-2 text-xs font-bold">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tạo sprint đầu tiên
            </Button>
          </div>
        ) : (
          [...sprints].reverse().map((sprint) => {
            const stats = sprintStats(sprint.id);
            const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            const taskProgress = stats.count > 0 ? Math.round((stats.doneCount / stats.count) * 100) : 0;

            return (
              <div
                key={sprint.id}
                onClick={() => setSelectedSprintId(sprint.id)}
                className="group relative rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:border-accent/60 hover:shadow-lg hover:bg-surface-2/40 transition-all space-y-4 cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5">
                        <span>{sprint.name}</span>
                      </h3>

                      {sprint.status === "ACTIVE" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          Đang hoạt động
                        </span>
                      )}

                      {sprint.status === "COMPLETED" && (
                        <span className="flex items-center gap-1 rounded-full bg-surface-2 border border-line px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Đã hoàn thành
                        </span>
                      )}

                      {sprint.status === "PLANNING" && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                          <Clock className="h-3.5 w-3.5" /> Lên kế hoạch
                        </span>
                      )}
                    </div>

                    {sprint.goal && (
                      <p className="text-xs text-muted-light leading-relaxed bg-surface-2/60 p-2.5 rounded-xl border border-line/60">
                        🎯 <strong>Mục tiêu:</strong> {sprint.goal}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted pt-1 flex-wrap">
                      {(sprint.startDate || sprint.endDate) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted/80" />
                          {sprint.startDate ? format(new Date(sprint.startDate), "dd/MM/yyyy") : "—"}
                          <span>→</span>
                          {sprint.endDate ? format(new Date(sprint.endDate), "dd/MM/yyyy") : "—"}
                        </span>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        {stats.count} công việc ({stats.doneCount} hoàn thành)
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-accent font-mono">
                        {stats.done}/{stats.total} points ({progress}%)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* View Details Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSprintId(sprint.id)}
                      className="h-8 text-xs font-bold border-line bg-surface hover:bg-surface-2 text-foreground group-hover:border-accent group-hover:text-accent"
                    >
                      <Layers className="h-3.5 w-3.5 mr-1" />
                      Chi tiết Sprint
                      <ArrowRight className="h-3 w-3 ml-1 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </Button>

                    {sprint.status === "PLANNING" && (
                      <Button
                        size="sm"
                        onClick={(e) => updateSprintStatus(sprint.id, "ACTIVE", e)}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Kích hoạt Sprint
                      </Button>
                    )}

                    {sprint.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        onClick={(e) => updateSprintStatus(sprint.id, "COMPLETED", e)}
                        className="h-8 text-xs font-semibold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Đóng Sprint
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted">
                    <span>Tiến độ hoàn thành Story Points</span>
                    <span className="font-bold text-foreground">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-line">
                    <div
                      className={`h-full transition-all duration-500 ${
                        progress === 100
                          ? "bg-emerald-500"
                          : progress > 50
                          ? "bg-accent"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SPRINT DETAIL DIALOG */}
      {selectedSprint && (
        <SprintDetailDialog
          projectId={projectId}
          projectName={projectName}
          projectKey={projectKey}
          sprint={selectedSprint}
          tasks={tasks}
          members={members}
          labels={labels}
          sprints={sprints}
          open={!!selectedSprintId}
          onOpenChange={(open) => !open && setSelectedSprintId(null)}
          onChanged={load}
          onSelectTask={(taskId) => setOpenTaskId(taskId)}
        />
      )}

      {/* TASK DETAIL DIALOG */}
      {openTaskId && (
        <TaskDialog
          projectId={projectId}
          taskId={openTaskId}
          tasks={tasks}
          members={members}
          labels={labels}
          sprints={sprints}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
        />
      )}

      {/* CREATE SPRINT MODAL */}
      <Dialog
        dismissableMask={true}
        closeOnEscape={true}
        visible={createOpen}
        onHide={() => setCreateOpen(false)}
        header={
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-accent" />
            <div>
              <div className="text-base font-bold text-foreground">Tạo Sprint Kế Hoạch Mới</div>
              <div className="text-xs text-muted font-normal mt-0.5">
                Sprint là chu kỳ phát triển 1-2 tuần để hoàn thành tập trung các mục tiêu
              </div>
            </div>
          </div>
        }
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl overflow-hidden"
        contentClassName="p-5"
      >
        <form
          onSubmit={createSprint}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              createSprint(e);
            }
          }}
          className="space-y-3.5 pt-1"
        >
          {error && (
            <div className="rounded-lg bg-accent-subtle p-2.5 text-xs text-accent border border-accent/20">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Tên Sprint *</Label>
            <Input
              placeholder="VD: Sprint 1 — Hoàn thiện tính năng Quản lý xe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs h-9"
              required
              minLength={2}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mục tiêu Sprint (Goal)</Label>
            <Textarea
              placeholder="Mục tiêu cốt lõi cần đạt được trong đợt chạy này..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ngày bắt đầu</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ngày kết thúc</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="cursor-pointer">
              <span>Hủy</span>
              <kbd className="text-[10px] text-muted ml-1 font-mono">Esc</kbd>
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="font-bold bg-accent hover:bg-accent/90 text-white cursor-pointer gap-1.5">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              <span>Tạo Sprint</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
