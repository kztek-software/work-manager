"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Send,
  MessageSquare,
  User,
  Mail,
  Phone,
  Building,
  Laptop,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KanbanSquare,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Lock,
  FolderKanban,
  ArrowRightLeft,
  AlertTriangle,
  PlayCircle,
  XCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Hand,
} from "lucide-react";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardHref } from "@/lib/board-link";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MediaGallery } from "@/components/ui/media-gallery";
import { FileUploadZone, type UploadedFileItem } from "@/components/ui/file-upload-zone";
import { RichMarkdown } from "@/components/ui/rich-markdown";
import { RichTextToolbar, handleRichTextKeyDown } from "@/components/ui/rich-text-toolbar";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import type { CustomerTicketDto, SprintDto, MemberDto } from "@/lib/types";
import {
  TICKET_CANCEL_REASONS,
  TICKET_CLOSE_REASONS,
  TICKET_PRIORITY_LABELS,
  htmlToPlainText,
  isTicketFinal,
} from "@/lib/ticket-status";
import { TicketStatusBadge, TicketStatusStepper } from "./ticket-status-ui";

type TicketHandlerOption = { id: string; name: string; avatarColor: string; title: string | null };

interface TicketDrawerProps {
  ticket: CustomerTicketDto | null;
  // Danh sách dự án để điều phối — chỉ truyền khi user có quyền tickets.assign
  assignableProjects?: Array<{ id: string; name: string; key: string }>;
  canAssign?: boolean;
  // Người dùng hiện tại (nhận biết "Bạn đang là người xử lý")
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onTicketUpdated: () => void;
}

// Dữ liệu form chuyển đổi: sprint & thành viên của dự án ĐÃ GÁN cho ticket
type ConvertOptions = {
  projectId: string;
  sprints: SprintDto[];
  members: MemberDto[];
};

export function TicketDrawer({
  ticket,
  assignableProjects = [],
  canAssign = false,
  currentUserId,
  isOpen,
  onClose,
  onTicketUpdated,
}: TicketDrawerProps) {
  // Mức ưu tiên đang chọn (chỉ lưu khi bấm "Xác nhận ưu tiên")
  const [priority, setPriority] = useState(ticket?.priority || "MEDIUM");
  const [internalNotes, setInternalNotes] = useState(ticket?.internalNotes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [actionError, setActionError] = useState("");
  // Hành động luồng trạng thái đang gửi (để khóa nút)
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Người xử lý: danh sách thành viên dự án đủ điều kiện (tải khi mở dropdown)
  const [handlers, setHandlers] = useState<TicketHandlerOption[] | null>(null);
  const [loadingHandlers, setLoadingHandlers] = useState(false);

  // Dialog Đóng / Hủy: bắt buộc lý do + mô tả
  const [finishKind, setFinishKind] = useState<"close" | "cancel" | null>(null);
  const [finishReason, setFinishReason] = useState("");
  const [finishDescription, setFinishDescription] = useState("");
  const [finishError, setFinishError] = useState("");

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const newCommentRef = useRef<HTMLTextAreaElement | null>(null);

  // Dispatch state ("" = bỏ gán dự án)
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState(ticket?.projectId || "");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState("");

  // Convert to Task state
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertOptions, setConvertOptions] = useState<ConvertOptions | null>(null);
  const [loadingConvertOptions, setLoadingConvertOptions] = useState(false);
  const [convertSprintId, setConvertSprintId] = useState<string>("");
  const [convertAssigneeId, setConvertAssigneeId] = useState<string>("");
  const [convertStatus, setConvertStatus] = useState<"TODO" | "BACKLOG" | "IN_PROGRESS">("TODO");
  const [convertCustomTitle, setConvertCustomTitle] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);

  // Quyền thao tác do API trả kèm ticket (mặc định chỉ xem nếu thiếu)
  const canWrite = ticket?.capabilities?.canWrite ?? false;
  const canConvert = ticket?.capabilities?.canConvert ?? false;
  const canDispatch = canAssign && assignableProjects.length > 0;

  // Đồng bộ form theo ticket đang mở. Điều chỉnh trong lúc render (thay vì
  // useEffect) để drawer không hiện dữ liệu ticket trước ở lượt render đầu.
  const [prevTicket, setPrevTicket] = useState(ticket);
  if (prevTicket !== ticket) {
    setPrevTicket(ticket);
    if (ticket) {
      setPriority(ticket.priority);
      setInternalNotes(ticket.internalNotes || "");
      setConvertCustomTitle(`[${ticket.trackingCode}] ${ticket.title}`);
      setTargetProjectId(ticket.projectId || "");
      // Đổi ticket hoặc đổi dự án đã gán -> sprint/thành viên cũ không còn đúng
      if (prevTicket?.id !== ticket.id || prevTicket?.projectId !== ticket.projectId) {
        setConvertOptions(null);
        setConvertSprintId("");
        setConvertAssigneeId("");
        setActionError("");
        setHandlers(null);
      }
    }
  }

  async function openConvertModal() {
    if (!ticket) return;
    setConvertError("");
    setConvertModalOpen(true);
    if (!ticket.projectId) {
      setConvertError("Ticket chưa được gán dự án. Cần người có quyền điều phối gán dự án trước khi chuyển thành task.");
      return;
    }
    if (convertOptions?.projectId === ticket.projectId) return;

    setLoadingConvertOptions(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/convert`);
      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || "Không tải được dữ liệu dự án của ticket");
      } else {
        setConvertOptions({
          projectId: ticket.projectId,
          sprints: data.sprints || [],
          members: data.members || [],
        });
      }
    } catch (err) {
      console.error("Lỗi tải dữ liệu chuyển đổi:", err);
      setConvertError("Lỗi kết nối máy chủ");
    } finally {
      setLoadingConvertOptions(false);
    }
  }

  async function handleDispatch() {
    if (targetProjectId === (ticket?.projectId || "")) {
      setDispatchError("Ticket đang thuộc dự án này");
      return;
    }
    setDispatching(true);
    setDispatchError("");
    try {
      const res = await fetch(`/api/tickets/${ticket!.id}/dispatch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProjectId: targetProjectId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDispatchError(data.error || "Không thể điều phối ticket");
      } else {
        setDispatchModalOpen(false);
        onTicketUpdated();
      }
    } catch (err) {
      console.error("Lỗi điều phối:", err);
      setDispatchError("Lỗi kết nối khi điều phối ticket");
    } finally {
      setDispatching(false);
    }
  }

  // PATCH /api/tickets/[id] — trả lỗi quyền ra UI thay vì im lặng
  async function patchTicket(payload: Record<string, unknown>): Promise<boolean> {
    setActionError("");
    const res = await fetch(`/api/tickets/${ticket!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Không thể cập nhật ticket");
      return false;
    }
    return true;
  }

  // POST /api/tickets/[id]/actions — server kiểm tra quyền & luồng trạng thái, lỗi trả ra UI
  async function postAction(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    setActionError("");
    setBusyAction(String(payload.action));
    try {
      const res = await fetch(`/api/tickets/${ticket!.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = data.error || "Không thể thực hiện thao tác";
        setActionError(error);
        return { ok: false, error };
      }
      onTicketUpdated();
      return { ok: true };
    } catch (err) {
      console.error("Lỗi thao tác ticket:", err);
      setActionError("Lỗi kết nối máy chủ");
      return { ok: false, error: "Lỗi kết nối máy chủ" };
    } finally {
      setBusyAction(null);
    }
  }

  async function ensureHandlersLoaded() {
    if (!ticket || handlers || loadingHandlers) return;
    setLoadingHandlers(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/handlers`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setHandlers(data.handlers || []);
      else setActionError(data.error || "Không tải được danh sách người xử lý");
    } catch (err) {
      console.error("Lỗi tải người xử lý:", err);
    } finally {
      setLoadingHandlers(false);
    }
  }

  function openFinishDialog(kind: "close" | "cancel") {
    setFinishKind(kind);
    setFinishReason("");
    setFinishDescription("");
    setFinishError("");
  }

  async function submitFinish() {
    if (!finishKind) return;
    if (!finishReason) {
      setFinishError(finishKind === "close" ? "Vui lòng chọn lý do đóng ticket" : "Vui lòng chọn lý do hủy ticket");
      return;
    }
    if (!htmlToPlainText(finishDescription)) {
      setFinishError("Vui lòng nhập mô tả (khách hàng sẽ nhận được qua email)");
      return;
    }
    setFinishError("");
    const result = await postAction({ action: finishKind, reason: finishReason, description: finishDescription });
    if (result.ok) setFinishKind(null);
    else setFinishError(result.error || "Không thể thực hiện thao tác");
  }

  async function handleReopen() {
    if (!confirm("Mở lại ticket này? Lý do và mô tả kết quả cũ sẽ được lưu vào bình luận nội bộ.")) return;
    await postAction({ action: "reopen" });
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const ok = await patchTicket({ internalNotes });
      if (ok) {
        onTicketUpdated();
      }
    } catch (err) {
      console.error("Lỗi lưu ghi chú:", err);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSendingComment(true);
    try {
      const ok = await patchTicket({
        newComment: {
          message: newComment.trim(),
          isInternalOnly,
        },
      });
      if (ok) {
        setNewComment("");
        onTicketUpdated();
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
    } finally {
      setSendingComment(false);
    }
  }

  async function handleConvert() {
    if (!ticket?.projectId) {
      setConvertError("Ticket chưa được gán dự án. Cần người có quyền điều phối gán dự án trước khi chuyển thành task.");
      return;
    }
    setConverting(true);
    setConvertError("");

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sprintId: convertSprintId || null,
          assigneeId: convertAssigneeId || null,
          status: convertStatus,
          customTitle: convertCustomTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || "Không thể chuyển đổi ticket");
      } else {
        setConvertModalOpen(false);
        onTicketUpdated();
      }
    } catch (err) {
      console.error("Lỗi convert:", err);
      setConvertError("Lỗi kết nối máy chủ");
    } finally {
      setConverting(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa tệp đính kèm này?")) return;
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      if (res.ok) onTicketUpdated();
    } catch (err) {
      console.error("Lỗi xóa attachment:", err);
    }
  }

  async function handleUploadAdditionalFiles(newFiles: UploadedFileItem[]) {
    const unattached = newFiles.filter((f) => !f.id);
    for (const file of unattached) {
      try {
        await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket!.id,
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            fileType: file.fileType,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
          }),
        });
      } catch (err) {
        console.error("Lỗi lưu attachment:", err);
      }
    }
    onTicketUpdated();
  }

  function copyTracking() {
    navigator.clipboard.writeText(ticket!.trackingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  // Keyboard shortcuts listener for TicketDrawer
  useEffect(() => {
    if (!isOpen || !ticket) return;

    function handleTicketDrawerKeyDown(e: KeyboardEvent) {
      // Ctrl + Enter / Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (convertModalOpen && !converting) {
          e.preventDefault();
          handleConvert();
          return;
        }
        if (dispatchModalOpen && !dispatching) {
          e.preventDefault();
          handleDispatch();
          return;
        }
        if (newComment.trim() && !sendingComment) {
          e.preventDefault();
          handleAddComment(e as unknown as React.FormEvent);
          return;
        }
      }

      // Alt + C: Chuyển đổi thành Task trên Board
      if (e.altKey && e.key.toLowerCase() === "c" && !ticket?.convertedTaskId && canConvert) {
        e.preventDefault();
        openConvertModal();
        return;
      }

      // Alt + D: Điều phối dự án
      if (e.altKey && e.key.toLowerCase() === "d" && canDispatch) {
        e.preventDefault();
        setDispatchModalOpen(true);
        return;
      }

      // Alt + L: Sao chép mã theo dõi ticket
      if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        copyTracking();
        return;
      }
    }

    window.addEventListener("keydown", handleTicketDrawerKeyDown);
    return () => window.removeEventListener("keydown", handleTicketDrawerKeyDown);
  }, [
    isOpen,
    convertModalOpen,
    dispatchModalOpen,
    converting,
    dispatching,
    newComment,
    sendingComment,
    ticket,
    canConvert,
    canDispatch,
  ]);

  if (!isOpen || !ticket) return null;

  const caps = ticket.capabilities;
  const final = isTicketFinal(ticket.status);
  const priorityConfirmed = Boolean(ticket.priorityConfirmedAt);
  // Đã xác nhận và chưa đổi lựa chọn -> không cần bấm lại
  const priorityDirty = priority !== ticket.priority;
  const priorityOptions = Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ label, value }));
  // Dropdown người xử lý: danh sách đã tải, hoặc tạm thời chỉ người đang được giao
  const handlerOptions = [
    { label: "-- Chưa có người xử lý --", value: "" },
    ...(handlers ?? (ticket.assignee ? [{ ...ticket.assignee, title: ticket.assignee.title ?? null }] : [])).map((h) => ({
      label: h.title ? `${h.name} (${h.title})` : h.name,
      value: h.id,
    })),
  ];
  const isMine = Boolean(ticket.assigneeId) && ticket.assigneeId === currentUserId;

  return (
    <>
      <Dialog
        dismissableMask={true}
        closeOnEscape={true}
        visible={isOpen}
        onHide={onClose}
        header={
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-black text-accent bg-[#F05922]/15 px-2 py-0.5 rounded border border-[#F05922]/30 flex items-center gap-1.5">
                <span>{ticket.trackingCode}</span>
                <button
                  type="button"
                  onClick={copyTracking}
                  className="hover:text-white cursor-pointer"
                  title="Chép mã"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </span>
              <span className="text-xs font-bold text-white truncate max-w-md">{ticket.title}</span>
            </div>

            <Link
              href={`/portal/tickets/${ticket.trackingCode}`}
              target="_blank"
              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Xem trang Portal</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        }
        className="w-full max-w-4xl border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-6 pt-2 max-h-[80vh] overflow-y-auto pr-1">
          {(actionError || !canWrite) && (
            <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-accent text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent shrink-0" />
              <span>{actionError || "Bạn chỉ có quyền xem ticket này."}</span>
            </div>
          )}

          {/* Luồng trạng thái: stepper + nút hành động theo trạng thái & quyền (server kiểm tra lại) */}
          <div className="p-4 rounded-xl border border-line bg-surface-2/70 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Trạng thái</span>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {caps?.canStart && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyAction !== null}
                    onClick={() => postAction({ action: "start" })}
                    className="h-8 px-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg cursor-pointer gap-1.5"
                  >
                    {busyAction === "start" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    <span>Bắt đầu xử lý</span>
                  </Button>
                )}
                {caps?.canClose && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyAction !== null}
                    onClick={() => openFinishDialog("close")}
                    className="h-8 px-3 text-xs font-bold rounded-lg cursor-pointer gap-1.5 border-emerald-500/50 text-emerald-400 [[data-theme=light]_&]:text-emerald-700 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đóng ticket</span>
                  </Button>
                )}
                {caps?.canCancel && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyAction !== null}
                    onClick={() => openFinishDialog("cancel")}
                    className="h-8 px-3 text-xs font-bold rounded-lg cursor-pointer gap-1.5 border-slate-500/50 text-slate-300 [[data-theme=light]_&]:text-slate-600 hover:bg-slate-500/10"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Hủy ticket</span>
                  </Button>
                )}
                {caps?.canReopen && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyAction !== null}
                    onClick={handleReopen}
                    className="h-8 px-3 text-xs font-bold rounded-lg cursor-pointer gap-1.5 border-[#F05922]/50 text-[#FFAA80] [[data-theme=light]_&]:text-[#C2410C] hover:bg-[#F05922]/10"
                  >
                    {busyAction === "reopen" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Mở lại</span>
                  </Button>
                )}
              </div>
            </div>
            <TicketStatusStepper status={ticket.status} progress={ticket.progress} compact />
            {!final && ticket.status !== "TRIAGED" && ticket.status !== "IN_PROGRESS" && (
              <p className="text-[11px] text-muted">
                Ticket tự động chuyển sang <strong className="text-foreground">Đã phân loại</strong> khi đã{" "}
                <span className={priorityConfirmed ? "line-through" : ""}>xác nhận mức ưu tiên</span> và{" "}
                <span className={ticket.projectId ? "line-through" : ""}>gán dự án phụ trách</span>.
              </p>
            )}
          </div>

          {/* Kết quả Đóng / Hủy (hiển thị cho khách trên Portal & email) */}
          {final && (
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                ticket.status === "CLOSED" ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-500/40 bg-slate-500/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="font-bold text-foreground">
                  {ticket.status === "CLOSED" ? "Lý do đóng" : "Lý do hủy"}: {ticket.closeReason || "—"}
                </span>
                {ticket.closedAt && (
                  <span className="text-[10px] text-muted font-mono">{format(new Date(ticket.closedAt), "HH:mm dd/MM/yyyy")}</span>
                )}
              </div>
              {ticket.resolutionNotes && (
                <div className="p-3 rounded-lg bg-surface border border-line text-xs text-foreground leading-relaxed">
                  <RichMarkdown content={ticket.resolutionNotes} />
                </div>
              )}
            </div>
          )}

          {/* Thông tin phân loại: ưu tiên, dự án, người xử lý */}
          <div className="p-4 rounded-xl border border-line bg-surface-2/70 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-4 flex-wrap">
              {/* Mức ưu tiên: mức khách chọn chỉ là gợi ý, nhân viên phải xác nhận */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Ưu tiên</span>
                <div className="flex items-center gap-1.5">
                  <Dropdown
                    value={priority}
                    options={priorityOptions}
                    onChange={(e) => setPriority(e.value)}
                    disabled={!caps?.canConfirmPriority || busyAction !== null}
                    className="h-8 text-xs font-bold bg-surface-3 border border-line rounded-lg"
                  />
                  {caps?.canConfirmPriority && (!priorityConfirmed || priorityDirty) ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyAction !== null}
                      onClick={() => postAction({ action: "confirm_priority", priority })}
                      className="h-8 px-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg cursor-pointer gap-1"
                      title="Xác nhận mức ưu tiên (bắt buộc để ticket được phân loại)"
                    >
                      {busyAction === "confirm_priority" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{priorityConfirmed ? "Lưu ưu tiên" : "Xác nhận ưu tiên"}</span>
                    </Button>
                  ) : null}
                </div>
                <span
                  className={`text-[10px] font-semibold block ${
                    priorityConfirmed
                      ? "text-emerald-400 [[data-theme=light]_&]:text-emerald-700"
                      : "text-amber-400 [[data-theme=light]_&]:text-amber-700"
                  }`}
                >
                  {priorityConfirmed ? "Đã xác nhận" : "Gợi ý từ khách hàng — chưa xác nhận"}
                </span>
              </div>

              {/* Người xử lý */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Người xử lý</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {caps?.canAssignHandler ? (
                    <Dropdown
                      value={ticket.assigneeId || ""}
                      options={handlerOptions}
                      onShow={ensureHandlersLoaded}
                      onChange={(e) => {
                        const next = (e.value as string) || null;
                        if (next !== (ticket.assigneeId || null)) postAction({ action: "assign", assigneeId: next });
                      }}
                      filter
                      filterPlaceholder="Tìm người xử lý..."
                      emptyMessage={loadingHandlers ? "Đang tải..." : "Không có thành viên đủ điều kiện"}
                      disabled={busyAction !== null}
                      className="h-8 min-w-[180px] text-xs font-bold bg-surface-3 border border-line rounded-lg"
                    />
                  ) : (
                    <span className="h-8 px-2.5 rounded-lg border border-line bg-surface-3 text-xs font-bold text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-accent" />
                      <span>{ticket.assignee ? ticket.assignee.name : "Chưa có người xử lý"}</span>
                      {isMine && <span className="text-[10px] font-semibold text-muted">(bạn)</span>}
                    </span>
                  )}
                  {caps?.canClaim && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyAction !== null}
                      onClick={() => postAction({ action: "claim", start: ticket.status === "TRIAGED" })}
                      className="h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer gap-1 border-[#F05922]/50 text-[#FFAA80] [[data-theme=light]_&]:text-[#C2410C] hover:bg-[#F05922]/10"
                      title={
                        ticket.status === "TRIAGED"
                          ? "Nhận ticket về mình và chuyển sang Đang xử lý"
                          : "Nhận ticket về mình xử lý"
                      }
                    >
                      {busyAction === "claim" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Hand className="w-3.5 h-3.5" />}
                      <span>{ticket.status === "TRIAGED" ? "Nhận & bắt đầu xử lý" : "Nhận xử lý"}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Project Assignment & Dispatch Badge */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Dự án phụ trách</span>
                <div className="flex items-center gap-1.5">
                  {ticket.project ? (
                    <span className="h-8 px-2.5 rounded-lg border border-line bg-surface-3 text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-accent" />
                      <span>{ticket.project.name}</span>
                    </span>
                  ) : (
                    <span className="h-8 px-2.5 rounded-lg border border-amber-400/50 dark:border-amber-500/40 bg-amber-500/15 dark:bg-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span>Chờ điều phối</span>
                    </span>
                  )}

                  {canDispatch && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDispatchModalOpen(true)}
                      className="h-8 px-2.5 text-xs border-line hover:border-accent text-muted hover:text-white cursor-pointer flex items-center gap-1.5"
                      title="Điều phối ticket tới dự án cụ thể (Alt+D)"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-accent" />
                      <span>{ticket.projectId ? "Chuyển dự án" : "Điều phối dự án"}</span>
                      <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono font-bold bg-surface-3 text-muted rounded border border-line">
                        Alt+D
                      </kbd>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 1-Click Convert to Task Button */}
            <div className="flex items-center gap-2">
              {ticket.convertedTaskId && ticket.convertedTask ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs">
                  <KanbanSquare className="w-4 h-4 text-purple-400" />
                  <span>
                    Đã chuyển đổi: <strong>Task #{ticket.convertedTask.number}</strong> ({ticket.convertedTask.status})
                  </span>
                  {ticket.projectId && (
                    <Link
                      href={boardHref(ticket.projectId)}
                      className="ml-1 text-accent hover:underline font-bold"
                    >
                      Xem Board
                    </Link>
                  )}
                </div>
              ) : !ticket.projectId ? (
                // Ticket chưa gán dự án: chưa thể tạo task (không biết tạo vào Board nào)
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/50 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs max-w-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {canDispatch
                      ? "Gán dự án cho ticket trước khi chuyển thành task."
                      : "Ticket chưa được gán dự án, chưa thể chuyển thành task."}
                  </span>
                </div>
              ) : canConvert ? (
                <Button
                  type="button"
                  title="Chuyển thành Task/Bug trên Board (Alt+C)"
                  onClick={openConvertModal}
                  className="h-9 px-4 bg-gradient-to-r from-[#F05922] to-[#FF8C00] hover:from-[#FF6B35] hover:to-[#FFA500] text-white font-bold text-xs rounded-xl shadow-md shadow-[#F05922]/25 cursor-pointer flex items-center gap-1.5"
                >
                  <KanbanSquare className="w-4 h-4" />
                  <span>Chuyển thành Task/Bug trên Board</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                    Alt+C
                  </kbd>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Customer info & Original Description */}
            <div className="md:col-span-2 space-y-5">
              {/* Customer Contact Details */}
              <div className="p-4 rounded-xl border border-line bg-surface-2/40 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Thông tin khách hàng báo lỗi
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <User className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>Họ tên: <strong className="text-white">{ticket.customerName}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>Email: <strong className="font-mono text-accent">{ticket.customerEmail}</strong></span>
                  </div>
                  {ticket.customerPhone && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>SĐT: <strong className="font-mono">{ticket.customerPhone}</strong></span>
                    </div>
                  )}
                  {ticket.customerCompany && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Building className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Đơn vị: <strong>{ticket.customerCompany}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Issue Description */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white block">Chi tiết sự cố:</span>
                <div className="p-4 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-foreground leading-relaxed">
                  <RichMarkdown content={ticket.description} />
                </div>
                {ticket.environment && (
                  <div className="flex items-center gap-2 text-xs text-muted pt-1">
                    <Laptop className="w-4 h-4 text-muted shrink-0" />
                    <span>Môi trường: <strong className="text-foreground">{ticket.environment}</strong></span>
                  </div>
                )}

                {/* Media Gallery for Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="pt-2">
                    <MediaGallery
                      attachments={ticket.attachments}
                      canDelete={canWrite}
                      onDelete={handleDeleteAttachment}
                      title="Tệp đính kèm / Ảnh / Video sự cố"
                    />
                  </div>
                )}

                {/* Staff Upload Additional Attachments */}
                {canWrite && (
                  <div className="pt-2">
                    <FileUploadZone
                      files={[]}
                      onChange={handleUploadAdditionalFiles}
                      compact
                      label="Tải thêm ảnh / video / tài liệu đính kèm"
                      helperText="Tải thêm tài liệu kỹ thuật hoặc hình ảnh minh họa cho ticket này"
                    />
                  </div>
                )}
              </div>

              {/* Internal Notes & Resolution Notes Editor */}
              <div className="space-y-4 pt-2 border-t border-line/60">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Ghi chú nội bộ (Chỉ nhân viên thấy)</span>
                    </Label>
                    <span className="text-[10px] text-muted">1. 2. 3., in đậm, màu trực quan</span>
                  </div>
                  <WysiwygEditor
                    value={internalNotes}
                    onChange={setInternalNotes}
                    placeholder="Ghi chú kỹ thuật, nguyên nhân gốc rễ, phân công nội bộ... (in đậm, màu, 1. 2. 3.)"
                    minHeight="70px"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || !canWrite}
                    className="h-8 px-4 bg-surface-3 hover:bg-accent text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    {savingNotes ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    <span>Lưu ghi chú nội bộ</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Message & Comment Log */}
            <div className="space-y-4 p-4 rounded-xl border border-line bg-surface-2/40 flex flex-col h-[520px]">
              <div className="flex items-center justify-between border-b border-line/60 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <span>Trao đổi ({ticket.comments?.length || 0})</span>
                </span>
                <span className="text-[10px] text-muted">Thời gian thực</span>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {!ticket.comments || ticket.comments.length === 0 ? (
                  <p className="text-xs text-muted text-center py-10">Chưa có bình luận trao đổi nào</p>
                ) : (
                  ticket.comments.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg border text-xs leading-relaxed space-y-1 ${
                        c.isInternalOnly
                          ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                          : c.isStaff
                          ? "bg-[#F05922]/15 border-[#F05922]/30 text-foreground"
                          : "bg-surface-3 border-line text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-bold text-white text-[11px]">{c.authorName}</span>
                          {c.isStaff && (
                            <span className="px-1 py-0.1 rounded text-[8px] font-bold bg-accent text-white">
                              Staff
                            </span>
                          )}
                          {c.isInternalOnly && (
                            <span className="px-1 py-0.1 rounded text-[8px] font-bold bg-amber-500 text-black flex items-center gap-0.5">
                              <EyeOff className="w-2.5 h-2.5" />
                              <span>Nội bộ</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted font-mono">
                          {format(new Date(c.createdAt), "HH:mm dd/MM")}
                        </span>
                      </div>
                      <div className="text-[11px]">
                        <RichMarkdown content={c.message} members={convertOptions?.members} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Send Comment Input */}
              <form onSubmit={handleAddComment} className="pt-2 border-t border-line/60 space-y-2">
                <RichTextToolbar
                  textareaRef={newCommentRef}
                  value={newComment}
                  onChange={setNewComment}
                  compact
                  disabled={sendingComment}
                  className="border-none bg-transparent p-0 mb-1"
                />

                <Textarea
                  ref={newCommentRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    handleRichTextKeyDown(
                      e as any,
                      newCommentRef,
                      newComment,
                      setNewComment
                    );
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleAddComment(e);
                    }
                  }}
                  placeholder="Nhập phản hồi gửi khách hàng hoặc ghi chú..."
                  rows={2}
                  className="bg-surface-3 border-line text-xs font-sans"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={isInternalOnly}
                      onChange={(e) => setIsInternalOnly(e.target.checked)}
                      className="rounded border-line bg-surface-3 text-accent focus:ring-0"
                    />
                    <span>Chỉ nội bộ (Khách không thấy)</span>
                  </label>

                  <Button
                    type="submit"
                    disabled={sendingComment || !newComment.trim() || !canWrite}
                    className="h-8.5 px-3.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl cursor-pointer gap-1.5 shadow-sm"
                  >
                    {sendingComment ? <RefreshCw className="w-3 h-3 animate-spin mr-0.5" /> : <Send className="w-3 h-3 mr-0.5" />}
                    <span>Gửi</span>
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                      Ctrl+Enter
                    </kbd>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CHUYỂN ĐỔI TICKET THÀNH TASK TRÊN KANBAN BOARD                     */}
      {/* ========================================================================= */}
      <Dialog
        dismissableMask={true}
        closeOnEscape={true}
        header="Chuyển Đổi Ticket Thành Task/Bug Trên Board"
        visible={convertModalOpen}
        onHide={() => setConvertModalOpen(false)}
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2 text-xs">
          {convertError && (
            <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-accent">
              {convertError}
            </div>
          )}

          {/* Task luôn được tạo trong dự án đã gán của ticket */}
          {ticket.project && (
            <div className="p-3 rounded-xl bg-surface-2 border border-line flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-muted">
                Tạo task trên Board dự án <strong className="text-foreground">{ticket.project.name} ({ticket.project.key})</strong>
              </span>
              {loadingConvertOptions && <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent ml-auto" />}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-bold">Tiêu đề Task trên Board</Label>
            <Input
              value={convertCustomTitle}
              onChange={(e) => setConvertCustomTitle(e.target.value)}
              className="h-9 bg-surface-2 text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Cột trạng thái ban đầu</Label>
            <Dropdown
              value={convertStatus}
              options={[
                { label: "Cần làm (To do)", value: "TODO" },
                { label: "Tồn đọng (Backlog)", value: "BACKLOG" },
                { label: "Đang thực hiện (In progress)", value: "IN_PROGRESS" },
              ]}
              onChange={(e) => setConvertStatus(e.value)}
              className="w-full h-9 text-xs font-medium bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Gán vào Sprint (Tùy chọn)</Label>
            <Dropdown
              value={convertSprintId}
              options={[
                { label: "-- Không gán sprint (Product Backlog) --", value: "" },
                ...(convertOptions?.sprints || []).map((s) => ({ label: `${s.name} (${s.status})`, value: s.id })),
              ]}
              onChange={(e) => setConvertSprintId(e.value)}
              className="w-full h-9 text-xs font-medium bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Người phụ trách xử lý</Label>
            <Dropdown
              value={convertAssigneeId}
              options={[
                { label: "-- Chưa chỉ định --", value: "" },
                ...(convertOptions?.members || []).map((m) => ({ label: `${m.user.name} (${m.user.title || m.role})`, value: m.user.id })),
              ]}
              onChange={(e) => setConvertAssigneeId(e.value)}
              className="w-full h-9 text-xs font-medium bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={converting || loadingConvertOptions || !ticket.projectId}
              onClick={handleConvert}
              className="bg-accent hover:bg-accent-hover text-white font-bold cursor-pointer gap-1.5"
            >
              {converting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <KanbanSquare className="w-3.5 h-3.5 mr-1" />}
              <span>Tạo Task & Chuyển Đổi</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: ĐÓNG / HỦY TICKET — bắt buộc lý do + mô tả (gửi email kết quả cho khách) */}
      {/* ========================================================================= */}
      <Dialog
        dismissableMask={false}
        closeOnEscape={true}
        header={finishKind === "cancel" ? "Hủy Ticket" : "Đóng Ticket"}
        visible={finishKind !== null}
        onHide={() => setFinishKind(null)}
        className="w-full max-w-xl border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2 text-xs">
          {finishError && (
            <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-accent flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{finishError}</span>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-bold">{finishKind === "cancel" ? "Lý do hủy *" : "Lý do đóng *"}</Label>
            <Dropdown
              value={finishReason}
              options={(finishKind === "cancel" ? TICKET_CANCEL_REASONS : TICKET_CLOSE_REASONS).map((r) => ({
                label: r,
                value: r,
              }))}
              onChange={(e) => setFinishReason(e.value)}
              placeholder="-- Chọn lý do --"
              className="w-full h-9 text-xs font-medium bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Mô tả cho khách hàng *</Label>
            <WysiwygEditor
              value={finishDescription}
              onChange={setFinishDescription}
              placeholder={
                finishKind === "cancel"
                  ? "Giải thích lý do hủy yêu cầu cho khách hàng..."
                  : "Mô tả kết quả xử lý / hướng dẫn cho khách hàng..."
              }
              minHeight="120px"
            />
            <p className="text-[10px] text-muted">
              Lý do và mô tả hiển thị trên trang tra cứu của khách và được gửi qua email ngay sau khi{" "}
              {finishKind === "cancel" ? "hủy" : "đóng"} ticket.
            </p>
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setFinishKind(null)}>
              Quay lại
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busyAction !== null}
              onClick={submitFinish}
              className="bg-accent hover:bg-accent-hover text-white font-bold cursor-pointer gap-1.5"
            >
              {busyAction === "close" || busyAction === "cancel" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : finishKind === "cancel" ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{finishKind === "cancel" ? "Xác nhận hủy & gửi email" : "Xác nhận đóng & gửi email"}</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Admin Dispatch Modal */}
      <Dialog
        dismissableMask={true}
        closeOnEscape={true}
        visible={dispatchModalOpen}
        onHide={() => setDispatchModalOpen(false)}
        header={
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <ArrowRightLeft className="w-4 h-4 text-accent" />
            <span>Điều Phối Ticket Tới Dự Án Cụ Thể</span>
          </div>
        }
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2">
          {dispatchError && (
            <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/30 text-accent text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent shrink-0" />
              <span>{dispatchError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-surface-2 border border-line text-xs space-y-1">
            <div className="font-bold text-foreground truncate">{ticket.title}</div>
            <div className="text-muted">
              Khách hàng: <strong>{ticket.customerName}</strong> ({ticket.customerEmail})
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Chọn Dự án phụ trách xử lý sự cố này:</Label>
            <Dropdown
              value={targetProjectId}
              options={[
                { label: "-- Bỏ gán dự án (trả về hàng chờ điều phối) --", value: "" },
                ...assignableProjects.map((p) => ({ label: `${p.name} (${p.key})`, value: p.id })),
              ]}
              filter
              filterPlaceholder="Tìm dự án..."
              onChange={(e) => setTargetProjectId(e.value)}
              className="w-full h-10 text-xs font-semibold bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#F05922]/10 border border-[#F05922]/20 text-[11px] text-muted-light space-y-1">
            <p className="font-bold text-accent">💡 Sau khi điều phối:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted">
              <li>
                Nếu mức ưu tiên đã được xác nhận, ticket tự động chuyển sang <strong>Đã phân loại</strong>.
              </li>
              <li>Người xử lý không thuộc dự án mới sẽ bị bỏ gán.</li>
              <li>Chọn &quot;Bỏ gán dự án&quot; để trả ticket về hàng chờ điều phối.</li>
              <li>Hệ thống gửi thông báo tới đội ngũ kỹ thuật của dự án đích.</li>
              <li>Kỹ sư dự án có thể bấm 1-Click chuyển đổi ticket thành Kanban Task.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDispatchModalOpen(false)}
              className="text-xs text-muted hover:text-white"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleDispatch}
              disabled={dispatching}
              className="bg-accent hover:bg-accent-hover text-white text-xs font-bold px-4"
            >
              {dispatching ? "Đang điều phối..." : "Xác nhận Điều Phối"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
