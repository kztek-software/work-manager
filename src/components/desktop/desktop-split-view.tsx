"use client";

import React, { useState } from "react";
import {
  Columns2,
  Maximize2,
  Minimize2,
  KanbanSquare,
  LayoutDashboard,
  Ticket,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Eye,
  Activity,
} from "lucide-react";
import { Dropdown } from "primereact/dropdown";
import { ticketStatusLabel } from "@/lib/ticket-status";

interface DesktopSplitViewProps {
  project: any;
  tasks: any[];
  tickets: any[];
  sprints: any[];
  onSelectTask: (task: any) => void;
  selectedTask: any;
  onOpenNewTask: () => void;
  onUpdateTaskStatus: (taskId: string, newStatus: string) => void;
}

export function DesktopSplitView({
  project,
  tasks = [],
  tickets = [],
  sprints = [],
  onSelectTask,
  selectedTask,
  onOpenNewTask,
  onUpdateTaskStatus,
}: DesktopSplitViewProps) {
  // Split ratio: '50-50' | '65-35' | '35-65' | '100-0' | '0-100'
  const [splitRatio, setSplitRatio] = useState<"50-50" | "65-35" | "35-65" | "100-0" | "0-100">(
    "65-35"
  );
  const [leftTab, setLeftTab] = useState<"BOARD" | "DASHBOARD" | "SPRINTS">("BOARD");
  const [rightTab, setRightTab] = useState<"INSPECTOR" | "TICKETS" | "ACTIVITY">("INSPECTOR");

  // Filter for left board
  const [boardSearch, setBoardSearch] = useState("");
  const [boardPriority, setBoardPriority] = useState("ALL");

  const filteredTasks = tasks.filter((t) => {
    const matchSearch =
      !boardSearch ||
      t.title?.toLowerCase().includes(boardSearch.toLowerCase()) ||
      t.key?.toLowerCase().includes(boardSearch.toLowerCase());
    const matchPriority = boardPriority === "ALL" || t.priority === boardPriority;
    return matchSearch && matchPriority;
  });

  const todoTasks = filteredTasks.filter((t) => t.status === "TODO");
  const inProgressTasks = filteredTasks.filter((t) => t.status === "IN_PROGRESS");
  const reviewTasks = filteredTasks.filter((t) => t.status === "REVIEW" || t.status === "TESTING");
  const doneTasks = filteredTasks.filter((t) => t.status === "DONE");

  // Priority color badge
  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENT":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-accent/20 text-accent rounded">GẤP</span>;
      case "HIGH":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">CAO</span>;
      case "MEDIUM":
        return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">TB</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-500/20 text-zinc-400 rounded">THẤP</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Split Controller Bar */}
      <div className="h-10 border-b border-line bg-surface-2/60 px-4 flex items-center justify-between text-xs">
        {/* Left pane navigation */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-muted mr-2 uppercase tracking-wider">
            Khung Trái:
          </span>
          <button
            type="button"
            onClick={() => {
              setLeftTab("BOARD");
              if (splitRatio === "0-100") setSplitRatio("65-35");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              leftTab === "BOARD" && splitRatio !== "0-100"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-muted hover:bg-surface-3"
            }`}
          >
            <KanbanSquare className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLeftTab("DASHBOARD");
              if (splitRatio === "0-100") setSplitRatio("65-35");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              leftTab === "DASHBOARD" && splitRatio !== "0-100"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-muted hover:bg-surface-3"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLeftTab("SPRINTS");
              if (splitRatio === "0-100") setSplitRatio("65-35");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              leftTab === "SPRINTS" && splitRatio !== "0-100"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-muted hover:bg-surface-3"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Sprints</span>
          </button>
        </div>

        {/* Center Split ratio buttons */}
        <div className="hidden md:flex items-center gap-1 bg-surface-3 p-0.5 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setSplitRatio("100-0")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              splitRatio === "100-0" ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted hover:text-foreground"
            }`}
            title="Tối đa khung trái"
          >
            Trái (100%)
          </button>
          <button
            type="button"
            onClick={() => setSplitRatio("65-35")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              splitRatio === "65-35" ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted hover:text-foreground"
            }`}
            title="Tỷ lệ 65:35"
          >
            65 : 35
          </button>
          <button
            type="button"
            onClick={() => setSplitRatio("50-50")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              splitRatio === "50-50" ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted hover:text-foreground"
            }`}
            title="Tỷ lệ 50:50"
          >
            50 : 50
          </button>
          <button
            type="button"
            onClick={() => setSplitRatio("35-65")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              splitRatio === "35-65" ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted hover:text-foreground"
            }`}
            title="Tỷ lệ 35:65"
          >
            35 : 65
          </button>
          <button
            type="button"
            onClick={() => setSplitRatio("0-100")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              splitRatio === "0-100" ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted hover:text-foreground"
            }`}
            title="Tối đa khung phải"
          >
            Phải (100%)
          </button>
        </div>

        {/* Right pane selector */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-muted mr-2 uppercase tracking-wider">
            Khung Phải:
          </span>
          <button
            type="button"
            onClick={() => {
              setRightTab("INSPECTOR");
              if (splitRatio === "100-0") setSplitRatio("65-35");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              rightTab === "INSPECTOR" && splitRatio !== "100-0"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-muted hover:bg-surface-3"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Chi tiết Task</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRightTab("TICKETS");
              if (splitRatio === "100-0") setSplitRatio("65-35");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              rightTab === "TICKETS" && splitRatio !== "100-0"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-muted hover:bg-surface-3"
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Tickets</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Workspace */}
      <div className="flex-1 flex h-[calc(100%-2.5rem)] overflow-hidden">
        {/* LEFT PANE */}
        {splitRatio !== "0-100" && (
          <div
            className={`flex flex-col h-full border-r border-line overflow-hidden bg-background transition-all duration-150 ${
              splitRatio === "100-0"
                ? "w-full"
                : splitRatio === "65-35"
                ? "w-[65%]"
                : splitRatio === "50-50"
                ? "w-[50%]"
                : "w-[35%]"
            }`}
          >
            {/* Left Content Header / Filters */}
            <div className="p-3 border-b border-line bg-surface-2/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
                  <input
                    type="text"
                    value={boardSearch}
                    onChange={(e) => setBoardSearch(e.target.value)}
                    placeholder="Lọc nhanh công việc..."
                    className="w-full pl-8 pr-3 py-1 text-xs bg-surface border border-line rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <Dropdown
                  value={boardPriority}
                  options={[
                    { label: "Độ ưu tiên", value: "ALL" },
                    { label: "Khẩn cấp", value: "URGENT" },
                    { label: "Cao", value: "HIGH" },
                    { label: "Trung bình", value: "MEDIUM" },
                    { label: "Thấp", value: "LOW" },
                  ]}
                  onChange={(e) => setBoardPriority(e.value)}
                  className="p-inputtext-sm h-7 text-xs bg-surface border border-line rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={onOpenNewTask}
                className="flex items-center gap-1.5 px-3 py-1 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-sm shadow-accent/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo việc</span>
              </button>
            </div>

            {/* Left Body Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === "BOARD" && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-full min-h-[450px]">
                  {/* TODO Column */}
                  <div className="bg-surface border border-line rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line/60">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-zinc-400" />
                        CẦN LÀM ({todoTasks.length})
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {todoTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedTask?.id === t.id
                              ? "bg-accent/15 border-accent shadow-sm"
                              : "bg-surface-2 hover:bg-surface-3 border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] text-muted">{t.key || "KZ-01"}</span>
                            {getPriorityBadge(t.priority)}
                          </div>
                          <div className="font-semibold text-foreground line-clamp-2">{t.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IN PROGRESS Column */}
                  <div className="bg-surface border border-line rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line/60">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        ĐANG LÀM ({inProgressTasks.length})
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {inProgressTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedTask?.id === t.id
                              ? "bg-accent/15 border-accent shadow-sm"
                              : "bg-surface-2 hover:bg-surface-3 border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] text-muted">{t.key || "KZ-02"}</span>
                            {getPriorityBadge(t.priority)}
                          </div>
                          <div className="font-semibold text-foreground line-clamp-2">{t.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* REVIEW Column */}
                  <div className="bg-surface border border-line rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line/60">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        KIỂM TRA ({reviewTasks.length})
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {reviewTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedTask?.id === t.id
                              ? "bg-accent/15 border-accent shadow-sm"
                              : "bg-surface-2 hover:bg-surface-3 border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] text-muted">{t.key || "KZ-03"}</span>
                            {getPriorityBadge(t.priority)}
                          </div>
                          <div className="font-semibold text-foreground line-clamp-2">{t.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DONE Column */}
                  <div className="bg-surface border border-line rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line/60">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        HOÀN THÀNH ({doneTasks.length})
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {doneTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all opacity-80 hover:opacity-100 ${
                            selectedTask?.id === t.id
                              ? "bg-accent/15 border-accent shadow-sm"
                              : "bg-surface-2 hover:bg-surface-3 border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] text-muted">{t.key || "KZ-04"}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <div className="font-semibold line-clamp-2 line-through text-muted">
                            {t.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {leftTab === "DASHBOARD" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-surface-2/60 border border-line">
                      <div className="text-xs text-muted">Tổng số công việc</div>
                      <div className="text-2xl font-bold text-foreground mt-1">{tasks.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-2/60 border border-line">
                      <div className="text-xs text-blue-400 font-semibold">Đang triển khai</div>
                      <div className="text-2xl font-bold text-blue-400 mt-1">{inProgressTasks.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-2/60 border border-line">
                      <div className="text-xs text-emerald-400 font-semibold">Đã hoàn thành</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">{doneTasks.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-2/60 border border-line">
                      <div className="text-xs text-accent font-bold">Tickets cần xử lý</div>
                      <div className="text-2xl font-bold text-accent mt-1">{tickets.length}</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-line">
                    <h4 className="text-xs font-semibold text-foreground mb-3">Tiến độ Sprint Hiện Tại</h4>
                    <div className="w-full bg-surface-3 h-3 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${tasks.length ? (doneTasks.length / tasks.length) * 100 : 0}%` }}
                        className="bg-emerald-500 h-full transition-all"
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted mt-2">
                      <span>{doneTasks.length} / {tasks.length} tasks</span>
                      <span>{tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0}% hoàn thành</span>
                    </div>
                  </div>
                </div>
              )}

              {leftTab === "SPRINTS" && (
                <div className="space-y-3">
                  {sprints.map((s, idx) => (
                    <div key={s.id || idx} className="p-4 rounded-xl bg-surface-2/60 border border-line">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{s.name || `Sprint ${idx + 1}`}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 rounded-full">
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-1">{s.goal || "Mục tiêu sprint hiện tại"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANE (Inspector / Tickets) */}
        {splitRatio !== "100-0" && (
          <div
            className={`flex flex-col h-full bg-surface/60 overflow-hidden transition-all duration-150 ${
              splitRatio === "0-100"
                ? "w-full"
                : splitRatio === "35-65"
                ? "w-[65%]"
                : splitRatio === "50-50"
                ? "w-[50%]"
                : "w-[35%]"
            }`}
          >
            {rightTab === "INSPECTOR" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-3 border-b border-line bg-surface-2/40 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-accent" />
                    Chi Tiết Công Việc (Inspector)
                  </span>
                  {selectedTask && (
                    <Dropdown
                      value={selectedTask.status}
                      options={[
                        { label: "Cần làm", value: "TODO" },
                        { label: "Đang làm", value: "IN_PROGRESS" },
                        { label: "Kiểm tra", value: "REVIEW" },
                        { label: "Hoàn thành", value: "DONE" },
                      ]}
                      onChange={(e) => onUpdateTaskStatus(selectedTask.id, e.value)}
                      className="p-inputtext-sm h-7 text-xs bg-surface border border-line rounded-lg font-medium"
                    />
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedTask ? (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-accent">
                            {selectedTask.key || "KZ-TASK"}
                          </span>
                          {getPriorityBadge(selectedTask.priority)}
                        </div>
                        <h3 className="text-base font-bold text-foreground">{selectedTask.title}</h3>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-2/80 border border-line space-y-2">
                        <div className="text-xs font-semibold text-muted">Mô tả</div>
                        <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                          {selectedTask.description || "Không có mô tả chi tiết."}
                        </div>
                      </div>

                      {/* Checklist / Subtasks preview */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>Danh sách việc phụ (Subtasks)</span>
                          <span className="text-muted text-[11px]">
                            {selectedTask.subtasks?.filter((st: any) => st.isCompleted).length || 0} /{" "}
                            {selectedTask.subtasks?.length || 0}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                            selectedTask.subtasks.map((st: any) => (
                              <div
                                key={st.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-line text-xs"
                              >
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 ${
                                    st.isCompleted ? "text-emerald-500" : "text-muted/40"
                                  }`}
                                />
                                <span className={st.isCompleted ? "line-through text-muted" : "text-foreground"}>
                                  {st.title}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted italic p-2 bg-surface-2 rounded-lg">
                              Chưa có việc phụ nào.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted">
                      <ListTodo className="w-10 h-10 mb-2 opacity-30 text-accent" />
                      <div className="text-xs font-semibold text-foreground">Chưa chọn công việc nào</div>
                      <div className="text-[11px] text-muted mt-1 max-w-xs">
                        Nhấp vào một thẻ bất kỳ ở bảng bên trái để xem đầy đủ chi tiết và thao tác tức thì.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === "TICKETS" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-3 border-b border-line bg-surface-2/40 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-accent" />
                    Phiếu Khách Hàng ({tickets.length})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {tickets.map((tk) => (
                    <div key={tk.id} className="p-3 rounded-xl bg-surface-2 border border-line space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold text-accent">{tk.trackingCode || tk.id}</span>
                        <span className="px-1.5 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-400">
                          {ticketStatusLabel(tk.status || "OPEN")}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground">{tk.title}</div>
                      <div className="text-[11px] text-muted line-clamp-1">{tk.customerName || tk.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
