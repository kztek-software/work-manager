"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  Plus,
  FileText,
  CheckSquare,
  X,
  Eye,
  Pencil,
  Tag,
  Settings2,
  Check,
  Paperclip,
  Layers,
  Rocket,
  User,
  Phone,
} from "lucide-react";
import { STATUSES, PRIORITIES, TASK_TYPES } from "@/lib/constants";
import type { LabelDto, MemberDto, SprintDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { FileUploadZone, type UploadedFileItem } from "@/components/ui/file-upload-zone";
import { AssigneeQuickSelect } from "./assignee-quick-select";
import { TypeIcon } from "./type-icon";
import { PriorityIcon } from "./priority-icon";
import { LabelManagerDialog } from "./label-manager-dialog";

export function NewTaskDialog({
  projectId,
  open,
  defaultStatus,
  defaultSprintId,
  members,
  labels,
  sprints,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  defaultStatus: string;
  defaultSprintId?: string;
  members: MemberDto[];
  labels: LabelDto[];
  sprints: SprintDto[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState("MEDIUM");
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [sprintId, setSprintId] = useState(defaultSprintId || "");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<string | null>(null);

  // Reset khi mở dialog
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setStatus(defaultStatus);
    setSprintId(defaultSprintId || "");
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
    setTitle("");
    setDescription("");
    setType("TASK");
    setPriority("MEDIUM");
    setStoryPoints("");
    setAssigneeId("");
    setSprintId("");
    setContactName("");
    setContactPhone("");
    setLabelIds([]);
    setSubtasks([]);
    setNewSubtask("");
    setAttachments([]);
    setError("");
    setAiSource(null);
  }

  function handleAddSubtask(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [...prev, newSubtask.trim()]);
    setNewSubtask("");
  }

  async function generateAiTask() {
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề sơ bộ để AI tự động gợi ý mô tả và checklist");
      return;
    }
    setError("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI không phản hồi");
        return;
      }
      if (data.description) setDescription(data.description);
      if (data.storyPoints) setStoryPoints(String(data.storyPoints));
      if (data.subtasks && Array.isArray(data.subtasks)) setSubtasks(data.subtasks);
      if (data.priority) setPriority(data.priority);
      setAiSource(data.source ?? "rule-based");
    } catch {
      setError("Lỗi kết nối AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          status,
          priority,
          storyPoints: storyPoints ? Number(storyPoints) : undefined,
          assigneeId: assigneeId || undefined,
          sprintId: sprintId || undefined,
          contactName: contactName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          labelIds,
          subtasks: subtasks.map((st) => ({ title: st })),
          attachments: attachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileType: att.fileType,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không tạo được task");
        return;
      }

      onOpenChange(false);
      onCreated();
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  const dialogHeader = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6 w-full">
      <div>
        <div className="text-sm sm:text-base font-bold text-foreground">Tạo công việc mới</div>
        <div className="text-[11px] sm:text-xs text-muted font-normal">
          Thêm task, bug, story hoặc epic kèm tài liệu, hình ảnh và checklist
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateAiTask}
        disabled={aiLoading || !title.trim()}
        title="AI Gợi ý chi tiết (Alt+A)"
        className="text-xs font-semibold border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 self-start sm:self-auto gap-1 h-7.5 sm:h-8"
      >
        {aiLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
        )}
        <span>AI Gợi ý chi tiết</span>
        <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono font-bold bg-amber-500/20 text-amber-700 rounded border border-amber-500/30">
          Alt+A
        </kbd>
      </Button>
    </div>
  );

  return (
    <>
    <Dialog
      visible={open}
      onHide={() => onOpenChange(false)}
      closable={false}
      showHeader={false}
      dismissableMask={true}
      closeOnEscape={true}
      className="w-[96vw] sm:w-[92vw] max-w-4xl border border-line bg-surface p-0 shadow-2xl rounded-2xl overflow-hidden h-[90vh] max-h-[90vh] flex flex-col"
      contentClassName="p-0 overflow-hidden flex flex-col h-full bg-surface"
    >
      <div className="w-full h-full flex flex-col overflow-hidden bg-surface">
        {/* Fixed Header */}
        <div className="shrink-0 border-b border-line bg-surface-2/70 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold text-foreground truncate">Tạo công việc mới</div>
            <div className="text-[11px] sm:text-xs text-muted font-normal truncate">
              Thêm task, bug, story hoặc epic kèm tài liệu, hình ảnh và checklist
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateAiTask}
              disabled={aiLoading || !title.trim()}
              title="AI Gợi ý chi tiết (Alt+A)"
              className="text-xs font-semibold border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 gap-1.5 h-8.5 rounded-lg cursor-pointer"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-0.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-0.5 text-amber-600" />
              )}
              <span>AI Gợi ý chi tiết</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9.5px] font-mono font-bold bg-amber-500/20 text-amber-700 rounded border border-amber-500/30">
                Alt+A
              </kbd>
            </Button>

            <button
              onClick={() => onOpenChange(false)}
              title="Đóng (Esc)"
              className="h-8.5 w-8.5 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-foreground hover:border-line-strong transition-colors cursor-pointer ml-0.5"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="new-task-form"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e);
            }
            if (e.altKey && e.key.toLowerCase() === "a") {
              e.preventDefault();
              generateAiTask();
            }
          }}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3.5 sm:p-4 space-y-2.5 sm:space-y-3"
        >
          {aiSource && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-600 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Đã tự động điền mô tả và checklist theo chuẩn AI KZTEK</span>
            </div>
          )}

          {/* Tiêu đề công việc */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted">Tiêu đề công việc *</Label>
            <Input
              placeholder="VD: Nâng cấp bo mạch cảm biến KZ-S200..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-8.5 bg-surface-2"
              required
              autoFocus
            />
          </div>

          {/* 6 trường thuộc tính cốt lõi: 2 hàng 3 cột */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Loại task</Label>
              <Dropdown
                value={type}
                options={TASK_TYPES.map((t) => ({ label: t.label, value: t.id }))}
                onChange={(e) => setType(e.value)}
                panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[180px]"
                className="h-8 w-full text-xs bg-surface-2 border border-line rounded-lg hover:border-line-strong transition-colors"
                valueTemplate={(opt) => {
                  const t = TASK_TYPES.find((x) => x.id === (opt?.value || type));
                  return (
                    <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                      <TypeIcon type={opt?.value || type} />
                      <span className="truncate">{t?.label || opt?.label}</span>
                    </div>
                  );
                }}
                itemTemplate={(opt) => {
                  const isSelected = type === opt.value;
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <TypeIcon type={opt.value} />
                        <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                    </div>
                  );
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Trạng thái</Label>
              <Dropdown
                value={status}
                options={STATUSES.map((s) => ({ label: s.label, value: s.id, color: s.color }))}
                onChange={(e) => setStatus(e.value)}
                panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[200px]"
                className="h-8 w-full text-xs bg-surface-2 border border-line rounded-lg hover:border-line-strong transition-colors"
                valueTemplate={(opt) => {
                  const s = STATUSES.find((x) => x.id === (opt?.value || status));
                  return (
                    <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                      <span className="h-2 w-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: s?.color || "#94a3b8" }} />
                      <span className="truncate">{s?.label || opt?.label}</span>
                    </div>
                  );
                }}
                itemTemplate={(opt) => {
                  const isSelected = status === opt.value;
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: opt.color }} />
                        <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                    </div>
                  );
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Độ ưu tiên</Label>
              <Dropdown
                value={priority}
                options={PRIORITIES.map((p) => ({ label: p.label, value: p.id, color: p.color }))}
                onChange={(e) => setPriority(e.value)}
                panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[180px]"
                className="h-8 w-full text-xs bg-surface-2 border border-line rounded-lg hover:border-line-strong transition-colors"
                valueTemplate={(opt) => {
                  const p = PRIORITIES.find((x) => x.id === (opt?.value || priority));
                  return (
                    <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                      <PriorityIcon priority={opt?.value || priority} />
                      <span className="truncate">{p?.label || opt?.label}</span>
                    </div>
                  );
                }}
                itemTemplate={(opt) => {
                  const isSelected = priority === opt.value;
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <PriorityIcon priority={opt.value} />
                        <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                    </div>
                  );
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Điểm ước lượng (Story points)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="VD: 5"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="text-xs h-8 bg-surface-2 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Người phụ trách</Label>
              <AssigneeQuickSelect
                variant="field"
                currentAssigneeId={assigneeId || null}
                members={members}
                onAssign={(_, userId) => setAssigneeId(userId || "")}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted">Sprint</Label>
              <Dropdown
                value={sprintId || "none"}
                options={[
                  { label: "Không thuộc sprint (Backlog)", value: "none", isBacklog: true },
                  ...sprints.map((s) => ({
                    label: s.name,
                    value: s.id,
                    statusText: s.status === "ACTIVE" ? "Đang chạy" : s.status === "COMPLETED" ? "Đã xong" : "Kế hoạch",
                  })),
                ]}
                onChange={(e) => setSprintId(e.value === "none" ? "" : e.value)}
                panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[240px]"
                className="h-8 w-full text-xs bg-surface-2 border border-line rounded-lg hover:border-line-strong transition-colors"
                valueTemplate={(opt) => {
                  const s = sprints.find((x) => x.id === (opt?.value || sprintId));
                  if (!s || (opt?.value === "none" || sprintId === "none" || !sprintId)) {
                    return (
                      <div className="flex items-center gap-1.5 font-normal text-muted truncate">
                        <Layers className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span className="truncate">Không thuộc sprint (Backlog)</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                      <Rocket className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </div>
                  );
                }}
                itemTemplate={(opt) => {
                  const isSelected = (sprintId || "none") === opt.value;
                  if (opt.isBacklog) {
                    return (
                      <div className="flex items-center justify-between gap-2 text-xs py-1 px-1 text-muted">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Layers className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="truncate">Không thuộc sprint (Backlog)</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Rocket className="h-3.5 w-3.5 text-accent shrink-0" />
                        <div className="min-w-0">
                          <span className={`font-semibold block truncate ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                          <span className="text-[10px] text-muted">{opt.statusText}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0 ml-1" />}
                    </div>
                  );
                }}
              />
            </div>
          </div>

          {/* Người liên hệ & Số điện thoại (Tùy chọn) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-line/40">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-accent" />
                Người liên hệ (Tùy chọn)
              </Label>
              <Input
                placeholder="VD: Anh Nam, Khách hàng..."
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="text-xs h-8 bg-surface-2"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-accent" />
                Số điện thoại liên hệ
              </Label>
              <Input
                placeholder="VD: 0912 345 678"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="text-xs h-8 bg-surface-2 font-mono"
              />
            </div>
          </div>

          {/* DÒNG NHÃN PHÂN LOẠI (Đồng bộ kích thước chuẩn, nhãn chọn cực nổi bật) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1 border-y border-line/50">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0">
                <Tag className="h-3.5 w-3.5 text-accent" />
                Nhãn phân loại:
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {labels.map((l) => {
                  const selected = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() =>
                        setLabelIds((prev) =>
                          selected ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                        )
                      }
                      className={cn(
                        "h-6.5 px-2.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 select-none",
                        selected
                          ? "shadow-sm ring-2 ring-accent/30 font-bold text-white border-transparent"
                          : "bg-surface-2 border border-line text-muted hover:text-foreground hover:border-line-strong hover:bg-surface-3"
                      )}
                      style={{
                        backgroundColor: selected ? l.color : undefined,
                        borderColor: selected ? l.color : undefined,
                      }}
                    >
                      {selected ? (
                        <Check className="h-3 w-3 stroke-[3]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      )}
                      <span>{l.name}</span>
                    </button>
                  );
                })}
                {labels.length === 0 && (
                  <span className="text-xs text-muted italic">Chưa có nhãn phân loại nào</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLabelManagerOpen(true)}
              className="text-[11px] font-semibold text-muted hover:text-accent transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-2 cursor-pointer border border-transparent hover:border-line shrink-0"
              title="Quản lý danh sách nhãn dự án"
            >
              <Settings2 className="h-3 w-3" />
              <span>Quản lý nhãn</span>
            </button>
          </div>

          {/* VÙNG GIỮA: 2 Cột Cân Đối (Mô tả chi tiết & Danh sách việc con) - Mỗi phần có 1 border bao ngoài */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
            {/* Cột Trái: Mô tả chi tiết */}
            <div className="flex flex-col space-y-1.5 rounded-xl border border-line bg-surface p-2.5 sm:p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-accent" />
                  Mô tả chi tiết
                </Label>
                <span className="text-[10px] text-muted">1. 2. 3., in đậm, màu trực quan</span>
              </div>

              <WysiwygEditor
                value={description}
                onChange={setDescription}
                placeholder="Mô tả yêu cầu, tiêu chí nghiệm thu... (Định dạng trực quan: in đậm, đổi màu chữ, danh sách 1. 2. 3., highlight, tiêu đề...)"
                minHeight="85px"
                borderless={true}
              />
            </div>

            {/* Cột Phải: Danh sách việc con (Checklist) */}
            <div className="flex flex-col space-y-1.5 rounded-xl border border-line bg-surface p-2.5 sm:p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-accent" />
                  Danh sách việc con (Checklist)
                </Label>
                <span className="text-[10px] font-bold text-muted bg-surface-2 border border-line px-2 py-0.5 rounded-full font-mono">
                  {subtasks.length} mục
                </span>
              </div>

              {/* Input thêm việc con nhanh */}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Nhập việc con mới (Enter để thêm)..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddSubtask();
                    }
                  }}
                  className="h-8 text-xs bg-surface-2"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAddSubtask()}
                  disabled={!newSubtask.trim()}
                  className="h-8 px-2.5 text-xs font-bold shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-0.5" /> Thêm
                </Button>
              </div>

              {/* Danh sách các subtasks */}
              <div className="h-[85px] overflow-y-auto no-scrollbar space-y-1 pr-0.5">
                {subtasks.length > 0 ? (
                  <ul className="space-y-1">
                    {subtasks.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs px-2.5 py-1 rounded-lg bg-surface-2 border border-line hover:border-line-strong transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                          <span className="truncate text-foreground font-medium">{s}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
                          className="text-muted hover:text-accent hover:bg-accent/10 rounded p-0.5 cursor-pointer transition-colors"
                          title="Xóa việc con này"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-2 rounded-lg text-muted">
                    <CheckSquare className="h-4 w-4 text-muted/40 mb-0.5" />
                    <p className="text-[11px] font-medium">Chưa có việc con nào</p>
                    <p className="text-[9.5px] text-muted/70">
                      Nhập ở trên hoặc nhấn <strong className="text-accent">Alt+A</strong> để AI tự tạo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VÙNG ĐÍNH KÈM TỆP TIN & MEDIA - Có 1 border bao ngoài */}
          <div className="space-y-1.5 rounded-xl border border-line bg-surface p-2.5 sm:p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-accent" />
                Đính kèm tệp tin & tài liệu
              </Label>
              <span className="text-[10px] text-muted font-mono">
                {attachments.length} tệp đã chọn
              </span>
            </div>

            <FileUploadZone
              files={attachments}
              onChange={setAttachments}
              compact={true}
              maxFiles={10}
              label=""
              helperText="Hỗ trợ ảnh chụp, video lỗi và tài liệu (Tối đa 25MB/tệp, 100MB/video)"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-accent-subtle px-3 py-2 text-xs text-accent font-medium border border-accent/20">
              {error}
            </p>
          )}
        </form>

        {/* Fixed Footer (Always Visible at Bottom) */}
        <div className="shrink-0 border-t border-line bg-surface-2/70 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-muted hidden sm:flex items-center gap-1.5">
            <span>Phím tắt:</span>
            <kbd className="px-1.5 py-0.5 font-mono text-[10px] font-bold bg-surface border border-line rounded">
              Ctrl+Enter
            </kbd>
            <span>để tạo công việc</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer hover:bg-surface-2"
            >
              <span>Hủy</span>
              <kbd className="hidden sm:inline-block text-[10px] text-muted opacity-70 ml-1 font-mono">
                Esc
              </kbd>
            </Button>
            <Button
              type="submit"
              form="new-task-form"
              disabled={loading}
              className="h-9 sm:h-10 px-5 text-xs sm:text-sm font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 cursor-pointer rounded-xl gap-2 transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-0.5" />
              ) : (
                <Plus className="h-4 w-4 mr-0.5" />
              )}
              <span>Tạo công việc</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9.5px] font-mono font-bold bg-white/20 text-white rounded">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </div>
      </div>
    </Dialog>

      <LabelManagerDialog
        projectId={projectId}
        labels={labels}
        open={labelManagerOpen}
        onOpenChange={setLabelManagerOpen}
        onLabelsChanged={onCreated}
      />
    </>
  );
}


