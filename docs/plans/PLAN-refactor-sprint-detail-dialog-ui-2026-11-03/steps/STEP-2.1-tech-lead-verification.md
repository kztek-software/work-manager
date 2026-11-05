---
step: 2.1
plan: ../PLAN-MASTER.md
agent: tech-lead
status: done
completed_at: 2026-11-03 07:22:00deps: [1.1, 1.2]
---

# STEP 2.1 — Review Kỹ Thuật & Typecheck Build

## Input nhận
- Code đã sửa tại `src/components/sprint/sprint-detail-dialog.tsx`.

## Nhiệm vụ
- Chạy `npx tsc --noEmit` xác thực TypeScript compile sạch 0 lỗi.
- Kiểm tra tính bảo toàn chức năng:
  - Phím tắt (Alt+N, Alt+B, Alt+E, Ctrl+Enter).
  - Quick status change qua API PATCH.
  - Xóa/Gỡ task khỏi Sprint.
  - Chuyển hướng Mở trên Board (`/board?sprintId=...`).
