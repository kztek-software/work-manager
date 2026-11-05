"use client";

import { Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICKET_STEPPER, TICKET_STATUS_META, ticketStepIndex, type TicketStatus } from "@/lib/ticket-status";

// ---------------------------------------------------------------------------
// Hiển thị trạng thái ticket dùng chung: badge (danh sách / drawer) và stepper (drawer / portal khách hàng).
// Theme mặc định tối; theme sáng bật bằng data-theme="light" trên <html> -> dùng variant [[data-theme=light]_&]:
// Màu thương hiệu: cam #F05922 / #FFAA80, navy #251C53 / #4A3F8C / #B8B3D6. Không dùng đỏ.
// ---------------------------------------------------------------------------

export const TICKET_STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  OPEN: "bg-[#F05922]/15 text-[#FFAA80] [[data-theme=light]_&]:text-[#C2410C] border-[#F05922]/40",
  ACKNOWLEDGED: "bg-[#B8B3D6]/15 text-[#B8B3D6] [[data-theme=light]_&]:text-[#4A3F8C] border-[#B8B3D6]/40",
  TRIAGED: "bg-[#4A3F8C]/30 text-[#D6D2EE] [[data-theme=light]_&]:text-[#251C53] [[data-theme=light]_&]:bg-[#4A3F8C]/15 border-[#4A3F8C]/60",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 [[data-theme=light]_&]:text-amber-700 border-amber-500/40",
  CLOSED: "bg-emerald-500/15 text-emerald-400 [[data-theme=light]_&]:text-emerald-700 border-emerald-500/40",
  CANCELLED: "bg-slate-500/15 text-slate-300 [[data-theme=light]_&]:text-slate-600 border-slate-500/40",
};

export function TicketStatusBadge({
  status,
  customer = false,
  className,
}: {
  status: string;
  // true -> dùng nhãn dành cho khách hàng
  customer?: boolean;
  className?: string;
}) {
  const meta = TICKET_STATUS_META[status as TicketStatus];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
        TICKET_STATUS_BADGE_CLASS[status as TicketStatus] || "bg-surface-3 text-muted border-line",
        className
      )}
    >
      {meta ? (customer ? meta.customerLabel : meta.label) : status}
    </span>
  );
}

const CUSTOMER_STEP_LABELS: Record<string, string> = {
  OPEN: "Mới / Tiếp nhận",
  ACKNOWLEDGED: "Đã tiếp nhận",
  TRIAGED: "Đã phân loại",
  IN_PROGRESS: "Đang xử lý",
  CLOSED: "Đã đóng",
};

type StepState = "done" | "current" | "pending" | "cancelled";
type TicketProgress = { acknowledged: boolean; triaged: boolean; started: boolean };

/**
 * Trạng thái từng bước. Ticket Đã hủy: chỉ đánh dấu ✓ các mốc thực sự đã đi qua (progress từ server),
 * bước cuối là "Đã hủy", các bước chưa qua để trống.
 */
function computeStepStates(status: string, progress?: TicketProgress | null): StepState[] {
  const last = TICKET_STEPPER.length - 1;
  if (status === "CANCELLED") {
    const reached = [true, Boolean(progress?.acknowledged), Boolean(progress?.triaged), Boolean(progress?.started)];
    return TICKET_STEPPER.map((_, idx) => (idx === last ? "cancelled" : reached[idx] ? "done" : "pending"));
  }
  const current = ticketStepIndex(status);
  return TICKET_STEPPER.map((step, idx) =>
    idx < current || (idx === current && step === "CLOSED") ? "done" : idx === current ? "current" : "pending"
  );
}

// Lưu ý: tailwind v3 + màu accent khai báo bằng var() không hỗ trợ /alpha -> dùng mã màu cụ thể
const STEP_BOX_CLASS: Record<StepState, string> = {
  done: "border-[#4A3F8C]/70 bg-[#4A3F8C]/25 text-foreground [[data-theme=light]_&]:bg-[#4A3F8C]/10",
  current:
    "border-[#F05922] bg-[#F05922]/20 ring-1 ring-[#F05922]/60 text-[#FFAA80] [[data-theme=light]_&]:text-[#C2410C] [[data-theme=light]_&]:bg-[#F05922]/10",
  pending: "border-line bg-surface-2/40 text-muted",
  cancelled: "border-slate-500/60 bg-slate-500/20 text-slate-200 [[data-theme=light]_&]:text-slate-700",
};
const STEP_DOT_CLASS: Record<StepState, string> = {
  done: "bg-[#4A3F8C] text-white",
  current: "bg-[#F05922] text-white",
  pending: "bg-surface-3 text-muted",
  cancelled: "bg-slate-500 text-white",
};

function StepDot({ state, idx, size }: { state: StepState; idx: number; size: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center font-bold",
        size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]",
        STEP_DOT_CLASS[state]
      )}
    >
      {state === "cancelled" ? (
        <XCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      ) : state === "done" ? (
        <Check className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      ) : (
        idx + 1
      )}
    </span>
  );
}

/**
 * Stepper 5 bước: Mới -> Đã tiếp nhận -> Đã phân loại -> Đang xử lý -> Đã đóng (hoặc Đã hủy).
 * Màn hình hẹp (< sm): danh sách dọc, nhãn đầy đủ không bị cắt. Từ sm trở lên: 5 cột ngang.
 */
export function TicketStatusStepper({
  status,
  progress,
  customer = false,
  compact = false,
}: {
  status: string;
  progress?: TicketProgress | null;
  customer?: boolean;
  compact?: boolean;
}) {
  const states = computeStepStates(status, progress);
  const labelOf = (step: TicketStatus, state: StepState) =>
    state === "cancelled" ? "Đã hủy" : customer ? CUSTOMER_STEP_LABELS[step] : TICKET_STATUS_META[step].label;

  return (
    <ol className={cn("flex flex-col sm:grid sm:grid-cols-5", compact ? "gap-1.5" : "gap-2 sm:gap-3")}>
      {TICKET_STEPPER.map((step, idx) => {
        const state = states[idx];
        return (
          <li
            key={step}
            className={cn(
              "rounded-xl border flex items-center gap-2 sm:gap-1.5 min-w-0 transition-all",
              compact ? "px-2 py-1.5" : "px-3 py-2 sm:p-3",
              STEP_BOX_CLASS[state]
            )}
            aria-current={state === "current" ? "step" : undefined}
          >
            <StepDot state={state} idx={idx} size={compact ? "sm" : "md"} />
            <span
              className={cn(
                "font-bold leading-tight sm:truncate",
                compact ? "text-[11px] sm:text-[10px]" : "text-xs"
              )}
              title={labelOf(step, state)}
            >
              {labelOf(step, state)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
