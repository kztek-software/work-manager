"use client";

import { useState } from "react";
import { Dialog } from "primereact/dialog";
import { Tag, Plus, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LabelDto } from "@/lib/types";

const PRESET_COLORS = [
  "#ef4444", // Đỏ
  "#f97316", // Cam
  "#eab308", // Vàng
  "#10b981", // Lục
  "#06b6d4", // Xanh ngọc
  "#3b82f6", // Lam
  "#8b5cf6", // Tím
  "#ec4899", // Hồng
  "#64748b", // Xám
];

interface LabelManagerDialogProps {
  projectId: string;
  labels: LabelDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLabelsChanged: () => void;
}

export function LabelManagerDialog({
  projectId,
  labels,
  open,
  onOpenChange,
  onLabelsChanged,
}: LabelManagerDialogProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Lỗi tạo nhãn");
        return;
      }
      setNewName("");
      setNewColor("#3b82f6");
      onLabelsChanged();
    } catch {
      setCreateError("Lỗi kết nối máy chủ");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(labelId: string) {
    if (!editName.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels/${labelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (res.ok) {
        setEditingId(null);
        onLabelsChanged();
      }
    } catch {
      alert("Lỗi cập nhật nhãn");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(labelId: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa nhãn này khỏi dự án? Các công việc đang gắn nhãn sẽ bị gỡ nhãn này.")) return;
    setDeletingId(labelId);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels/${labelId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onLabelsChanged();
      }
    } catch {
      alert("Lỗi xóa nhãn");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog
      visible={open}
      onHide={() => onOpenChange(false)}
      header="Quản lý Nhãn phân loại (Labels)"
      className="max-w-md w-[95vw] rounded-2xl bg-surface border border-line shadow-2xl"
      contentClassName="p-4 bg-surface text-foreground space-y-4"
      headerClassName="px-4 py-3 bg-surface-2/60 border-b border-line text-sm font-bold text-foreground"
      dismissableMask={true}
    >
      {/* Form Tạo Nhãn Mới */}
      <form onSubmit={handleCreate} className="rounded-xl border border-line bg-surface-2/40 p-3 space-y-2.5">
        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-accent" />
          <span>Tạo nhãn mới cho dự án</span>
        </div>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên nhãn (VD: comp:api, tech:react)..."
            className="h-8 text-xs bg-surface border-line flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={creating || !newName.trim()}
            className="h-8 text-xs font-bold bg-accent hover:bg-accent/90 text-white shrink-0"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Thêm
          </Button>
        </div>

        {/* Color Presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-muted font-medium mr-1">Màu sắc:</span>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className="h-5 w-5 rounded-full transition-all cursor-pointer flex items-center justify-center border border-white/20"
              style={{
                backgroundColor: c,
                transform: newColor === c ? "scale(1.2)" : "scale(1)",
                outline: newColor === c ? `2px solid ${c}` : "none",
                outlineOffset: "2px",
              }}
            >
              {newColor === c && <Check className="h-3 w-3 text-white stroke-[3]" />}
            </button>
          ))}
        </div>

        {createError && <p className="text-[11px] text-rose-500 font-medium">{createError}</p>}
      </form>

      {/* Danh sách nhãn hiện tại */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-muted uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-accent" />
            Danh sách nhãn ({labels.length})
          </span>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5 divide-y divide-line/40">
          {labels.length === 0 ? (
            <p className="text-xs text-muted text-center py-4 italic">Dự án chưa có nhãn phân loại nào.</p>
          ) : (
            labels.map((l) => {
              const isEditing = editingId === l.id;
              if (isEditing) {
                return (
                  <div key={l.id} className="pt-2 pb-1 space-y-2 bg-surface-2/60 p-2 rounded-lg border border-line">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs bg-surface border-line flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={updating || !editName.trim()}
                        onClick={() => handleUpdate(l.id)}
                        className="h-7 px-2 text-xs font-bold bg-accent text-white"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-7 px-2 text-xs text-muted"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className="h-4 w-4 rounded-full cursor-pointer border border-white/20"
                          style={{
                            backgroundColor: c,
                            outline: editColor === c ? `2px solid ${c}` : "none",
                            outlineOffset: "1px",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={l.id} className="flex items-center justify-between gap-2 pt-1.5 first:pt-0">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${l.color}18`,
                      color: l.color,
                      border: `1px solid ${l.color}40`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(l.id);
                        setEditName(l.name);
                        setEditColor(l.color);
                      }}
                      className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                      title="Sửa nhãn"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === l.id}
                      onClick={() => handleDelete(l.id)}
                      className="p-1 rounded text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Xóa nhãn"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
