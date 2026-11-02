"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Check, UserPlus, Search, X, Users, UserX, ChevronDown, Layers } from "lucide-react";
import type { MemberDto } from "@/lib/types";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";

export function AssigneeQuickSelect({
  taskId = "",
  currentAssigneeId,
  currentAssignee,
  members,
  onAssign,
  variant = "avatar",
  className = "",
}: {
  taskId?: string;
  currentAssigneeId: string | null;
  currentAssignee?: { id: string; name: string; avatarColor?: string; team?: { name: string; color?: string } | null } | null;
  members: MemberDto[];
  onAssign: (taskId: string, userId: string | null) => void;
  variant?: "avatar" | "field";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveAssignee = useMemo(() => {
    if (currentAssignee) return currentAssignee;
    if (!currentAssigneeId) return null;
    const found = members.find((m) => m.user.id === currentAssigneeId);
    return found?.user || null;
  }, [currentAssignee, currentAssigneeId, members]);

  // Danh sách các nhóm (teams) duy nhất từ danh sách thành viên
  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; count: number }>();
    let noTeamCount = 0;

    for (const m of members) {
      if (m.user.team) {
        const t = m.user.team;
        if (!map.has(t.id)) {
          map.set(t.id, { id: t.id, name: t.name, color: t.color || "#F05922", count: 1 });
        } else {
          map.get(t.id)!.count++;
        }
      } else {
        noTeamCount++;
      }
    }

    const list = Array.from(map.values());
    if (noTeamCount > 0 && list.length > 0) {
      list.push({ id: "NONE", name: "Chưa phân nhóm", color: "#6B7280", count: noTeamCount });
    }
    return list;
  }, [members]);

  // Lọc thành viên theo từ khóa (keyword) và nhóm (team)
  const filteredMembers = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return members.filter((m) => {
      // 1. Lọc theo nhóm
      if (selectedTeam !== "ALL") {
        if (selectedTeam === "NONE" && m.user.team) return false;
        if (selectedTeam !== "NONE" && m.user.team?.id !== selectedTeam) return false;
      }

      // 2. Lọc theo từ khóa (tên, email, vai trò, chức danh, tên nhóm)
      if (q) {
        const nameMatch = m.user.name.toLowerCase().includes(q);
        const emailMatch = m.user.email?.toLowerCase().includes(q);
        const roleMatch = m.role?.toLowerCase().includes(q);
        const titleMatch = m.user.title?.toLowerCase().includes(q);
        const teamMatch = m.user.team?.name.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !roleMatch && !titleMatch && !teamMatch) {
          return false;
        }
      }

      return true;
    });
  }, [members, keyword, selectedTeam]);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 340;
    const itemCount = members.length + 1;
    const estimatedHeight = Math.min(itemCount * 52 + 180, 480);

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;
    // Nếu phía dưới không đủ không gian và phía trên rộng hơn -> lật lên trên
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      top = Math.max(12, rect.top - estimatedHeight - 6);
    }

    let left = variant === "field" ? rect.left : rect.right - menuWidth;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) left = 12;

    setCoords({ top, left });
  }, [members.length, variant]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!open) {
      setKeyword("");
      setSelectedTeam("ALL");
      calculatePosition();
      setOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => {
      setOpen(false);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const selectUser = (userId: string | null, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    onAssign(taskId, userId);
  };

  return (
    <>
      {variant === "field" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          className={`h-8 w-full text-xs bg-surface-2 border border-line rounded-lg flex items-center justify-between px-2.5 text-foreground hover:border-line-strong transition-colors cursor-pointer text-left ${className}`}
          aria-label="Chọn người phụ trách"
        >
          {effectiveAssignee ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar className="h-5 w-5 border border-white/10 shadow-xs shrink-0">
                <AvatarFallback color={effectiveAssignee.avatarColor} className="text-[8px] font-bold">
                  {initials(effectiveAssignee.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-semibold text-foreground text-xs">{effectiveAssignee.name}</span>
              {effectiveAssignee.team && (
                <span
                  className="font-bold px-1 rounded text-[8.5px] shrink-0 border ml-0.5"
                  style={{
                    backgroundColor: `${effectiveAssignee.team.color || "#F05922"}18`,
                    color: effectiveAssignee.team.color || "#F05922",
                    borderColor: `${effectiveAssignee.team.color || "#F05922"}35`,
                  }}
                >
                  {effectiveAssignee.team.name}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 text-muted">
              <div className="h-5 w-5 rounded-full border border-dashed border-line-strong flex items-center justify-center shrink-0 bg-surface-3">
                <UserX className="h-2.5 w-2.5 text-muted" />
              </div>
              <span className="text-xs font-normal">Chưa giao việc</span>
            </div>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0 ml-1" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          className="rounded-full shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent transition-transform hover:scale-105"
          aria-label="Gán người phụ trách"
        >
          {effectiveAssignee ? (
            <Avatar className="h-[23px] w-[23px] ring-1 ring-black/5 dark:ring-white/10 border border-background shadow-xs shrink-0">
              <AvatarFallback color={effectiveAssignee.avatarColor} className="text-[9.5px] font-bold">
                {initials(effectiveAssignee.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted/70 hover:border-accent hover:text-accent hover:bg-accent/10 transition-colors">
              <Plus className="h-3 w-3" />
            </div>
          )}
        </button>
      )}

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Click-away backdrop overlay: Đảm bảo click ra ngoài là đóng ngay lập tức */}
            <div
              className="fixed inset-0 z-[9998] bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />

            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                zIndex: 9999,
              }}
              className="w-[340px] max-h-[500px] flex flex-col rounded-2xl border border-line-strong bg-surface p-3.5 shadow-2xl shadow-black/70 animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3 shrink-0">
                <div className="flex items-center gap-2 font-bold text-[13px] text-foreground">
                  <UserPlus className="h-4 w-4 text-accent" />
                  <span>Gán người phụ trách</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-mono text-muted bg-surface-2 border border-line px-2 py-0.5 rounded-md font-semibold">
                    {filteredMembers.length}/{members.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-6.5 w-6.5 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Keyword Search Input: Chiều cao rộng rãi h-11, cỡ chữ text-sm nhập liệu êm ái */}
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm tên, email, vai trò, từ khóa..."
                  className="w-full h-11 pl-10 pr-9 text-sm bg-surface-2 border border-line rounded-xl text-foreground placeholder:text-muted/70 focus:outline-none focus:border-accent focus:bg-surface transition-all font-medium shadow-2xs"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-3 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Bộ lọc Nhóm dạng Select rộng rãi h-10: Hỗ trợ mọi số lượng nhóm không bao giờ bị cắt chữ */}
              {teams.length > 0 && (
                <div className="relative mb-3 shrink-0">
                  <div className="relative flex items-center">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent pointer-events-none" />
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="w-full h-10 pl-9 pr-9 text-xs sm:text-[13px] font-semibold bg-surface-2 border border-line rounded-xl text-foreground appearance-none cursor-pointer focus:outline-none focus:border-accent hover:border-line-strong transition-colors"
                    >
                      <option value="ALL">👥 Tất cả nhóm ({members.length} nhân sự)</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          🏢 {t.name} ({t.count} nhân sự)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Danh sách thành viên & Chưa giao việc: Rộng rãi, thoáng mắt */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
                {/* Option Chưa Giao Việc */}
                {(!keyword || "chưa giao việc".includes(keyword.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={(e) => selectUser(null, e)}
                    className={`relative w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs text-left transition-all cursor-pointer ${
                      !currentAssigneeId
                        ? "bg-accent/20 border-2 border-accent shadow-md shadow-accent/15 ring-1 ring-accent/40"
                        : "text-muted hover:bg-surface-2 hover:text-foreground border border-line/40 hover:border-line"
                    }`}
                  >
                    {!currentAssigneeId && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                    )}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          !currentAssigneeId
                            ? "border-2 border-accent bg-accent/20 text-accent shadow-xs scale-105"
                            : "border border-dashed border-line-strong text-muted bg-surface-2"
                        }`}
                      >
                        <UserX className="h-4 w-4" />
                      </div>
                      <div>
                        <div
                          className={`text-[13px] ${
                            !currentAssigneeId ? "font-extrabold text-accent" : "font-semibold text-foreground"
                          }`}
                        >
                          Chưa giao việc
                        </div>
                        <div className="text-[10.5px] text-muted">Bỏ người phụ trách công việc này</div>
                      </div>
                    </div>
                    {!currentAssigneeId && (
                      <div className="shrink-0 flex items-center gap-1 bg-accent text-white px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xs">
                        <span>Đang chọn</span>
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                )}

                {/* Danh sách thành viên */}
                {filteredMembers.map((m) => {
                  const isSelected = currentAssigneeId === m.user.id;
                  return (
                    <button
                      key={m.user.id}
                      type="button"
                      onClick={(e) => selectUser(m.user.id, e)}
                      className={`relative w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent/20 border-2 border-accent shadow-md shadow-accent/15 ring-1 ring-accent/40"
                          : "text-foreground hover:bg-surface-2 border border-line/40 hover:border-line"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                      )}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar
                          className={`h-9 w-9 shrink-0 shadow-xs transition-all ${
                            isSelected
                              ? "border-2 border-accent ring-2 ring-accent/40 scale-105"
                              : "border border-white/15"
                          }`}
                        >
                          <AvatarFallback color={m.user.avatarColor} className="text-[10px] font-extrabold">
                            {initials(m.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate leading-tight ${
                              isSelected
                                ? "text-[13.5px] font-extrabold text-accent"
                                : "text-[13px] font-bold text-foreground"
                            }`}
                          >
                            {m.user.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-muted truncate mt-0.5">
                            {m.user.team && (
                              <span
                                className="font-bold px-1.5 py-0.2 rounded text-[9.5px] shrink-0 border"
                                style={{
                                  backgroundColor: `${m.user.team.color || "#F05922"}18`,
                                  color: m.user.team.color || "#F05922",
                                  borderColor: `${m.user.team.color || "#F05922"}35`,
                                }}
                              >
                                {m.user.team.name}
                              </span>
                            )}
                            <span className="truncate">{m.user.email || m.role}</span>
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="shrink-0 flex items-center gap-1 bg-accent text-white px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xs">
                          <span>Đang chọn</span>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}

                {filteredMembers.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted space-y-1.5">
                    <Users className="h-7 w-7 mx-auto text-muted/40" />
                    <p className="font-bold text-[13px] text-foreground">Không tìm thấy nhân sự</p>
                    <p className="text-[11px] text-muted">Thử tìm theo từ khóa khác hoặc đổi nhóm</p>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}