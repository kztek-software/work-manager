"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Search,
  Plus,
  ExternalLink,
  KanbanSquare,
  Bug,
  HelpCircle,
  Sparkles,
  Wrench,
  CheckCircle2,
  RefreshCw,
  FolderKanban,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Paginator, type PaginatorPageChangeEvent } from "primereact/paginator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TicketDrawer } from "./ticket-drawer";
import type { CustomerTicketDto } from "@/lib/types";
import type { TicketStats } from "@/lib/tickets";
import { TICKET_STATUSES, TICKET_STATUS_META } from "@/lib/ticket-status";
import { TicketStatusBadge } from "./ticket-status-ui";

type TicketStatsState = TicketStats;

interface TicketListViewProps {
  // Dự án user được xem ticket (người điều phối: mọi dự án) — dùng cho bộ lọc & điều phối
  projects: Array<{ id: string; name: string; key: string }>;
  canAssign: boolean;
  canCreate: boolean;
  // "ALL" | "UNASSIGNED" | projectId
  initialProjectFilter: string;
  // Mở sẵn drawer ticket (từ ?ticketId= trên URL / link thông báo)
  initialTicket?: CustomerTicketDto | null;
  initialTickets: CustomerTicketDto[];
  initialStats: TicketStatsState;
  // Người dùng hiện tại (bộ lọc "Của tôi", nhận biết người xử lý)
  currentUserId: string;
}

export function TicketListView({
  projects,
  canAssign,
  canCreate,
  initialProjectFilter,
  initialTicket = null,
  initialTickets,
  initialStats,
  currentUserId,
}: TicketListViewProps) {
  const [tickets, setTickets] = useState<CustomerTicketDto[]>(initialTickets);
  const [stats, setStats] = useState<TicketStatsState>(initialStats);
  const [loading, setLoading] = useState(false);

  // Bộ lọc dự án: ALL | UNASSIGNED (chỉ người điều phối) | projectId
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectFilter);
  const [projectOptions, setProjectOptions] = useState(projects);
  const selectedProject = projectOptions.find((p) => p.id === projectFilter) || null;

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  // Người xử lý: ALL | ME | NONE
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Pagination State
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);

  // Selected Ticket for Drawer
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicketDto | null>(initialTicket);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialTicket));
  const selectedTicketIdRef = useRef<string | null>(initialTicket?.id ?? null);

  // Create Ticket Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"BUG" | "SUPPORT" | "FEATURE_REQ" | "INQUIRY">("BUG");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  const [newEnvironment, setNewEnvironment] = useState("");
  // Chỉ người điều phối mới chọn được dự án khi ghi nhận ticket ("" = chưa gán)
  const [newProjectId, setNewProjectId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createNotice, setCreateNotice] = useState("");

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("projectId", projectFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (assigneeFilter !== "ALL") params.set("assignee", assigneeFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/tickets?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
        setStats(data.stats);
        if (data.projects) setProjectOptions(data.projects);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách ticket:", err);
    } finally {
      setLoading(false);
    }
  }

  // Tải lại chi tiết ticket đang mở trong drawer
  async function refreshSelectedTicket(ticketId: string) {
    const res = await fetch(`/api/tickets/${ticketId}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ticket) {
      setSelectedTicket(data.ticket);
    } else if (res.status === 404) {
      // Ticket đã ra khỏi phạm vi xem (vd: bị điều phối sang dự án khác)
      setDrawerOpen(false);
      setSelectedTicket(null);
    }
  }

  // Đồng bộ ?projectId= & ?ticketId= trên URL (không điều hướng lại trang server)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (projectFilter === "ALL") url.searchParams.delete("projectId");
    else url.searchParams.set("projectId", projectFilter);
    if (drawerOpen && selectedTicket) url.searchParams.set("ticketId", selectedTicket.id);
    else url.searchParams.delete("ticketId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [projectFilter, drawerOpen, selectedTicket]);

  // Realtime: nhận sự kiện ticket (kể cả ticket chưa gán) qua /api/tickets/stream.
  // Ref giữ hàm/ticket mới nhất để kết nối SSE chỉ mở 1 lần.
  const fetchTicketsRef = useRef(fetchTickets);
  useEffect(() => {
    fetchTicketsRef.current = fetchTickets;
    selectedTicketIdRef.current = drawerOpen ? selectedTicket?.id ?? null : null;
  });
  useEffect(() => {
    const es = new EventSource("/api/tickets/stream");
    let errorCount = 0;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    es.onopen = () => {
      errorCount = 0;
    };
    es.onerror = () => {
      errorCount++;
      // Server từ chối (401/403 -> CLOSED) hoặc lỗi lặp lại -> dừng hẳn
      if (es.readyState === EventSource.CLOSED || errorCount >= 5) es.close();
    };
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (typeof msg.type !== "string" || !msg.type.startsWith("TICKET_")) return;
        // Gom nhiều sự kiện liên tiếp thành 1 lần tải lại
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          fetchTicketsRef.current();
          const openId = selectedTicketIdRef.current;
          if (openId && msg.ticketId === openId) refreshSelectedTicket(openId);
        }, 400);
      } catch {
        // ignore
      }
    };

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      es.close();
    };
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    // Dữ liệu ban đầu (initialTickets/initialStats) đã được server render sẵn đúng bộ lọc mặc định
    // -> bỏ qua lần fetch đầu tiên để tránh gọi API thừa và tránh bảng bị mờ ngay khi vừa vào trang.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchTickets();
  }, [projectFilter, statusFilter, assigneeFilter, priorityFilter, typeFilter]);

  // Reset trang về 1 khi thay đổi bộ lọc hoặc tìm kiếm.
  // Điều chỉnh ngay trong lúc render (thay vì useEffect) để tránh render thừa
  // với danh sách đã phân trang sai — xem "Adjusting state when a prop changes".
  const filterKey = `${projectFilter}|${statusFilter}|${assigneeFilter}|${priorityFilter}|${typeFilter}|${search}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setFirst(0);
  }

  // Cắt lát danh sách ticket theo trang hiện tại
  const paginatedTickets = useMemo(() => {
    return tickets.slice(first, first + rows);
  }, [tickets, first, rows]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchTickets();
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!newCustomerName.trim() || !newCustomerEmail.trim() || !newTitle.trim() || !newDescription.trim()) {
      setCreateError("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: canAssign && newProjectId ? newProjectId : null,
          title: newTitle.trim(),
          description: newDescription.trim(),
          type: newType,
          priority: newPriority,
          customerName: newCustomerName.trim(),
          customerEmail: newCustomerEmail.trim(),
          customerPhone: newCustomerPhone.trim() || null,
          customerCompany: newCustomerCompany.trim() || null,
          environment: newEnvironment.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Không thể tạo ticket");
      } else {
        setCreateModalOpen(false);
        // Reset form
        setNewTitle("");
        setNewDescription("");
        setNewCustomerName("");
        setNewCustomerEmail("");
        setNewCustomerPhone("");
        setNewCustomerCompany("");
        setNewEnvironment("");
        setNewProjectId("");
        await fetchTickets();
        if (canAssign) {
          await refreshSelectedTicket(data.ticket.id);
          setDrawerOpen(true);
        } else {
          // Ticket chưa gán dự án -> user không có quyền điều phối sẽ không thấy cho tới khi được gán
          setCreateNotice(
            `Đã ghi nhận ticket ${data.ticket.trackingCode}. Ticket đang chờ điều phối và sẽ hiển thị khi được gán vào dự án bạn tham gia.`
          );
        }
      }
    } catch (err) {
      console.error("Lỗi tạo ticket:", err);
      setCreateError("Lỗi kết nối máy chủ");
    } finally {
      setCreating(false);
    }
  }

  const priorityBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    LOW: { label: "Thấp", bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/30" },
    MEDIUM: { label: "Trung bình", bg: "bg-yellow-500/15", text: "text-yellow-600", border: "border-yellow-500/30" },
    HIGH: { label: "Cao", bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30" },
    URGENT: { label: "Khẩn cấp", bg: "bg-[#F05922]/15", text: "text-accent", border: "border-[#F05922]/30" },
  };

  const typeIcons: Record<string, any> = {
    BUG: Bug,
    SUPPORT: Wrench,
    FEATURE_REQ: Sparkles,
    INQUIRY: HelpCircle,
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Bar */}
      <div className="p-4 sm:p-6 border-b border-line bg-surface/80 backdrop-blur-md shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F05922]/15 text-accent border border-[#F05922]/30 shadow-md">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                  Ticket & Báo Lỗi Khách Hàng
                </h1>
                {selectedProject && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F05922]/20 text-accent border border-[#F05922]/30">
                    {selectedProject.key}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                Tiếp nhận sự cố từ portal công khai, phân loại và chuyển đổi trực tiếp sang Kanban Board.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/portal"
              target="_blank"
              className="h-9 px-3.5 rounded-xl border border-line bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Cổng Portal Khách Hàng</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            {canCreate && (
            <Button
              type="button"
              onClick={() => {
                setCreateNotice("");
                setCreateModalOpen(true);
              }}
              className="h-9 px-4 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl shadow-md shadow-[#F05922]/25 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ghi Nhận Ticket Mới</span>
            </Button>
            )}
          </div>
        </div>

        {/* KPI Summary Cards — bấm để lọc */}
        {/* Các thẻ trạng thái cộng lại bằng Tổng; "Của tôi" là bộ lọc người xử lý riêng */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mt-5">
          {[
            { key: "ALL", label: "Tổng số ticket", value: stats.total, tone: "text-foreground" },
            {
              key: "OPEN",
              label: "Mới (chưa tiếp nhận)",
              value: stats.open,
              tone: "text-[#FFAA80] [[data-theme=light]_&]:text-[#C2410C]",
            },
            {
              key: "ACKNOWLEDGED",
              label: "Đã tiếp nhận",
              value: stats.acknowledged,
              tone: "text-[#B8B3D6] [[data-theme=light]_&]:text-[#4A3F8C]",
            },
            {
              key: "TRIAGED",
              label: "Đã phân loại",
              value: stats.triaged,
              tone: "text-[#D6D2EE] [[data-theme=light]_&]:text-[#251C53]",
            },
            {
              key: "IN_PROGRESS",
              label: "Đang xử lý",
              value: stats.inProgress,
              tone: "text-amber-400 [[data-theme=light]_&]:text-amber-700",
            },
            {
              key: "CLOSED",
              label: "Đã đóng",
              value: stats.closed,
              tone: "text-emerald-400 [[data-theme=light]_&]:text-emerald-700",
            },
            {
              key: "CANCELLED",
              label: "Đã hủy",
              value: stats.cancelled,
              tone: "text-slate-300 [[data-theme=light]_&]:text-slate-600",
            },
          ].map((card) => (
            <button
              type="button"
              key={card.key}
              onClick={() => {
                setStatusFilter(card.key);
                setAssigneeFilter("ALL");
              }}
              className={cn(
                "p-3.5 rounded-xl border transition-all cursor-pointer text-left",
                statusFilter === card.key && assigneeFilter === "ALL"
                  ? "border-accent bg-[#F05922]/10 shadow-md ring-1 ring-[#F05922]/30"
                  : "border-line bg-surface-2/60 hover:bg-surface-2"
              )}
            >
              <div className={cn("text-[10px] font-bold uppercase tracking-wider", card.key === "ALL" ? "text-muted" : card.tone)}>
                {card.label}
              </div>
              <div className={cn("text-xl font-black mt-1", card.tone)}>{card.value}</div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setAssigneeFilter(assigneeFilter === "ME" ? "ALL" : "ME");
              setStatusFilter("ALL");
            }}
            className={cn(
              "p-3.5 rounded-xl border transition-all cursor-pointer text-left",
              assigneeFilter === "ME"
                ? "border-accent bg-[#F05922]/10 shadow-md ring-1 ring-[#F05922]/30"
                : "border-line bg-surface-2/60 hover:bg-surface-2"
            )}
            title="Ticket chưa kết thúc mà bạn là người xử lý"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#B8B3D6] [[data-theme=light]_&]:text-[#4A3F8C]">
              Của tôi (đang mở)
            </div>
            <div className="text-xl font-black mt-1 text-[#B8B3D6] [[data-theme=light]_&]:text-[#4A3F8C]">{stats.mine}</div>
          </button>
        </div>
      </div>

      {/* Bộ lọc dự án: Tất cả / Chưa gán (người điều phối) / từng dự án được xem */}
      <div className="flex items-center gap-1 border-b border-line bg-surface-2/40 px-3 sm:px-6 pt-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setProjectFilter("ALL")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            projectFilter === "ALL"
              ? "border-accent text-accent bg-surface/50 rounded-t-lg"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-accent" />
          <span>{canAssign ? "Tất Cả Tickets" : "Tất Cả Dự Án Của Tôi"}</span>
        </button>

        {canAssign && (
          <button
            type="button"
            onClick={() => setProjectFilter("UNASSIGNED")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              projectFilter === "UNASSIGNED"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-surface/50 rounded-t-lg"
                : "border-transparent text-muted hover:text-amber-700 dark:hover:text-amber-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Chưa Gán / Chờ Điều Phối</span>
            {typeof stats.unassigned === "number" && stats.unassigned > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-black border border-amber-400/50 dark:border-amber-500/30">
                {stats.unassigned}
              </span>
            )}
          </button>
        )}

        <div className="flex items-center gap-2 px-2 pb-1.5 shrink-0">
          <FolderKanban className={cn("w-3.5 h-3.5", selectedProject ? "text-accent" : "text-muted")} />
          <Dropdown
            value={selectedProject ? selectedProject.id : null}
            options={projectOptions.map((p) => ({ label: `${p.name} (${p.key})`, value: p.id }))}
            onChange={(e) => setProjectFilter(e.value || "ALL")}
            placeholder="Lọc theo dự án..."
            filter
            filterPlaceholder="Tìm dự án..."
            showClear={Boolean(selectedProject)}
            emptyMessage="Không có dự án"
            className={cn(
              "p-inputtext-sm h-8 min-w-[200px] text-xs font-semibold bg-surface-2 border rounded-lg",
              selectedProject ? "border-accent" : "border-line"
            )}
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 sm:px-6 border-b border-line bg-surface/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none z-10" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã TK-XXXX, tiêu đề, tên hoặc email khách..."
            className="pl-9 h-8 bg-surface-2 border-line text-xs"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <Dropdown
            value={statusFilter}
            options={[
              { label: "Mọi trạng thái", value: "ALL" },
              ...TICKET_STATUSES.map((st) => ({ label: TICKET_STATUS_META[st].label, value: st })),
            ]}
            onChange={(e) => setStatusFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          {/* Người xử lý */}
          <Dropdown
            value={assigneeFilter}
            options={[
              { label: "Mọi người xử lý", value: "ALL" },
              { label: "Của tôi", value: "ME" },
              { label: "Chưa có người xử lý", value: "NONE" },
            ]}
            onChange={(e) => setAssigneeFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          {/* Priority filter */}
          <Dropdown
            value={priorityFilter}
            options={[
              { label: "Mọi mức độ", value: "ALL" },
              { label: "Khẩn cấp", value: "URGENT" },
              { label: "Cao", value: "HIGH" },
              { label: "Trung bình", value: "MEDIUM" },
              { label: "Thấp", value: "LOW" },
            ]}
            onChange={(e) => setPriorityFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          {/* Type filter */}
          <Dropdown
            value={typeFilter}
            options={[
              { label: "Mọi loại lỗi", value: "ALL" },
              { label: "Lỗi phần mềm", value: "BUG" },
              { label: "Hỗ trợ kỹ thuật", value: "SUPPORT" },
              { label: "Tính năng mới", value: "FEATURE_REQ" },
              { label: "Hỏi đáp", value: "INQUIRY" },
            ]}
            onChange={(e) => setTypeFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTickets}
            className="h-8 px-2 text-xs text-muted hover:text-foreground"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Table / List View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {createNotice && (
          <div className="mb-4 p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-xs text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <span className="flex-1">{createNotice}</span>
            <button
              type="button"
              onClick={() => setCreateNotice("")}
              className="text-muted hover:text-foreground cursor-pointer text-[11px] font-semibold"
            >
              Đóng
            </button>
          </div>
        )}
        {loading && tickets.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-xs font-semibold text-muted flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" />
              Đang tải danh sách ticket...
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center space-y-3 rounded-2xl border border-line/60 bg-surface/30">
            <div className="w-12 h-12 rounded-full bg-surface-2 text-muted flex items-center justify-center mx-auto">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Chưa có ticket nào phù hợp</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {canAssign
                ? "Không tìm thấy ticket báo lỗi theo tiêu chí lọc hiện tại, hoặc chưa có khách hàng gửi báo lỗi."
                : "Không có ticket phù hợp trong các dự án bạn tham gia. Ticket mới cần được điều phối vào dự án trước khi hiển thị ở đây."}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl border border-line bg-surface/90 overflow-hidden shadow-xl transition-opacity",
              loading && "opacity-50 pointer-events-none"
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line bg-surface-2/80 text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Mã Tra Cứu</th>
                    <th className="py-3 px-4">Tiêu Đề Sự Cố</th>
                    <th className="py-3 px-4">Dự Án Phụ Trách</th>
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4">Người Xử Lý</th>
                    <th className="py-3 px-4">Ưu Tiên</th>
                    <th className="py-3 px-4">Kanban Task</th>
                    <th className="py-3 px-4 text-right">Thời Gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {paginatedTickets.map((t) => {
                    const priorityMeta = priorityBadges[t.priority] || priorityBadges.MEDIUM;
                    const TypeIcon = typeIcons[t.type] || Bug;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelectedTicket(t);
                          setDrawerOpen(true);
                          // Tải chi tiết mới nhất — mở lần đầu tự động chuyển Mới → Đã tiếp nhận (server)
                          refreshSelectedTicket(t.id).then(() => {
                            if (t.status === "OPEN") fetchTickets();
                          });
                        }}
                        className="hover:bg-surface-2/80 transition-colors cursor-pointer group"
                      >
                        {/* Tracking Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-accent">
                          <span className="group-hover:underline">{t.trackingCode}</span>
                        </td>

                        {/* Title & Type */}
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                            <span className="font-bold text-foreground group-hover:text-accent transition-colors truncate">
                              {t.title}
                            </span>
                            {t._count && t._count.comments > 0 ? (
                              <span className="px-1.5 py-0.1 rounded text-[9px] bg-surface-3 text-muted border border-line">
                                {t._count.comments}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Project Assignment */}
                        <td className="py-3.5 px-4">
                          {t.project ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-foreground border border-line">
                              <FolderKanban className="w-3 h-3 text-accent" />
                              <span>{t.project.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50 dark:border-amber-500/40">
                              <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                              <span>Chờ điều phối</span>
                            </span>
                          )}
                        </td>

                        {/* Customer Info */}
                        <td className="py-3.5 px-4">
                          <div className="truncate font-medium text-foreground">{t.customerName}</div>
                          <div className="truncate text-[10px] text-muted font-mono">{t.customerEmail}</div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <TicketStatusBadge status={t.status} />
                        </td>

                        {/* Assignee */}
                        <td className="py-3.5 px-4">
                          {t.assignee ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                                style={{ backgroundColor: t.assignee.avatarColor }}
                              >
                                {t.assignee.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate max-w-[120px]">{t.assignee.name}</span>
                              {t.assignee.id === currentUserId && <span className="text-[10px] text-muted">(bạn)</span>}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">Chưa có</span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {priorityMeta.label}
                          </span>
                        </td>

                        {/* Converted Kanban Task */}
                        <td className="py-3.5 px-4">
                          {t.convertedTaskId && t.convertedTask ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-500 border border-purple-500/30">
                              <KanbanSquare className="w-3 h-3 text-purple-500" />
                              <span>#{t.convertedTask.number}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">Chưa tạo</span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-4 text-right text-[11px] text-muted font-mono">
                          {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-line bg-surface-2/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted font-medium">
                Hiển thị <strong className="text-foreground">{tickets.length > 0 ? first + 1 : 0}</strong> -{" "}
                <strong className="text-foreground">{Math.min(first + rows, tickets.length)}</strong> trên tổng số{" "}
                <strong className="text-foreground">{tickets.length}</strong> ticket
              </div>
              <Paginator
                first={first}
                rows={rows}
                totalRecords={tickets.length}
                rowsPerPageOptions={[5, 10, 20, 50]}
                onPageChange={(e: PaginatorPageChangeEvent) => {
                  setFirst(e.first);
                  setRows(e.rows);
                }}
                className="!bg-transparent !p-0 !border-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Drawer */}
      <TicketDrawer
        ticket={selectedTicket}
        assignableProjects={canAssign ? projectOptions : []}
        canAssign={canAssign}
        currentUserId={currentUserId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onTicketUpdated={async () => {
          await fetchTickets();
          if (selectedTicket) await refreshSelectedTicket(selectedTicket.id);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: TẠO TICKET BÁO LỖI NỘI BỘ (STAFF INTAKE MODAL)                    */}
      {/* ========================================================================= */}
      <Dialog
        dismissableMask={true}
        closeOnEscape={true}
        header="Ghi Nhận Ticket Báo Lỗi Khách Hàng (Nội Bộ)"
        visible={createModalOpen}
        onHide={() => setCreateModalOpen(false)}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 pt-2 text-xs">
          {createError && (
            <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-accent">
              {createError}
            </div>
          )}

          {/* Chỉ người có quyền điều phối mới gán được dự án khi ghi nhận */}
          {canAssign ? (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dự án phụ trách</Label>
              <Dropdown
                value={newProjectId}
                options={[
                  { label: "-- Chưa gán (chờ điều phối) --", value: "" },
                  ...projectOptions.map((p) => ({ label: `${p.name} (${p.key})`, value: p.id })),
                ]}
                onChange={(e) => setNewProjectId(e.value)}
                filter
                filterPlaceholder="Tìm dự án..."
                className="w-full h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-surface-2 border border-line text-muted flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Ticket sẽ vào hàng chờ điều phối. Người có quyền điều phối sẽ gán dự án phụ trách.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên khách hàng *</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nguyễn Văn A..."
                className="h-8 bg-surface-2 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email khách hàng *</Label>
              <Input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="customer@domain.com..."
                className="h-8 bg-surface-2 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Số điện thoại</Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="0912..."
                className="h-8 bg-surface-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Đơn vị / Công ty</Label>
              <Input
                value={newCustomerCompany}
                onChange={(e) => setNewCustomerCompany(e.target.value)}
                placeholder="KZTEK..."
                className="h-8 bg-surface-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phân loại</Label>
              <Dropdown
                value={newType}
                options={[
                  { label: "Báo lỗi phần mềm (BUG)", value: "BUG" },
                  { label: "Hỗ trợ kỹ thuật (SUPPORT)", value: "SUPPORT" },
                  { label: "Tính năng mới (FEATURE_REQ)", value: "FEATURE_REQ" },
                  { label: "Hỏi đáp & Tư vấn (INQUIRY)", value: "INQUIRY" },
                ]}
                onChange={(e) => setNewType(e.value)}
                className="w-full h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mức độ ưu tiên</Label>
              <Dropdown
                value={newPriority}
                options={[
                  { label: "Thấp (LOW)", value: "LOW" },
                  { label: "Trung bình (MEDIUM)", value: "MEDIUM" },
                  { label: "Cao (HIGH)", value: "HIGH" },
                  { label: "Khẩn cấp (URGENT)", value: "URGENT" },
                ]}
                onChange={(e) => setNewPriority(e.value)}
                className="w-full h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tiêu đề sự cố *</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tóm tắt sự cố khách hàng phản ánh..."
              className="h-8 bg-surface-2 text-xs font-semibold"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả chi tiết *</Label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Chi tiết phản ánh từ khách hàng..."
              rows={3}
              className="bg-surface-2 text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Môi trường / Thiết bị</Label>
            <Input
              value={newEnvironment}
              onChange={(e) => setNewEnvironment(e.target.value)}
              placeholder="VD: App mobile v2.1, iOS 17..."
              className="h-8 bg-surface-2 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creating}
              className="bg-accent hover:bg-accent-hover text-white font-bold cursor-pointer"
            >
              {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              <span>Lưu & Sinh Mã Tra Cứu</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
