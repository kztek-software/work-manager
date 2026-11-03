---
step: 2.1
plan: ../PLAN-MASTER.md
agent: tech-lead
status: done
completed_at: 2026-11-03 08:20:00deps: [1.1, 1.2]
---

# STEP 2.1 — Review Kỹ Thuật, Typecheck & Verification

## Input nhận
- Code đã sửa tại `src/components/app-shell.tsx` và `src/components/board/task-card.tsx`.

## Nhiệm vụ
- Chạy `npx tsc --noEmit` xác thực TypeScript compile sạch 0 lỗi.
- Kiểm tra tính bảo toàn chức năng: click chọn dự án, toggle nhóm, kéo thả Kanban card.
