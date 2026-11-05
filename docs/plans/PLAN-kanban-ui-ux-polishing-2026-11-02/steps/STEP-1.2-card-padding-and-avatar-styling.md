---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-02 20:41
deps: [1.1]
---

# STEP 1.2 — Chuẩn hóa Padding Thẻ & Avatar Styling

## Input nhận
Nhận từ PLAN-MASTER và Step 1.1: Padding bên trong thẻ task và avatar người phụ trách cần tinh tế, hòa hợp với phong cách Modern Enterprise.

## Nhiệm vụ
- Cập nhật `src/components/board/task-card.tsx`:
  - Padding bên trong thẻ: Chuẩn hóa `p-3`, đường phân cách footer `pt-2 border-t border-line/50`.
  - Avatar người phụ trách: Tinh chỉnh kích thước `h-[23px] w-[23px]`, thêm viền nổi `ring-1 ring-black/5 dark:ring-white/10 border border-background shadow-xs`.
- Cập nhật `src/components/board/assignee-quick-select.tsx`:
  - Đồng bộ kích thước và viền nổi avatar tương ứng.

## Definition of Done
- [x] Thẻ task có nhịp điệu padding đồng đều.
- [x] Avatar có viền 3D nhẹ, thanh lịch và sắc nét.

## Đã làm
- Cập nhật `task-card.tsx` chuẩn hóa padding thẻ `p-3`, footer `pt-2 border-t border-line/50`.
- Nâng cấp styling cho avatar với kích thước `23px` viền nổi `ring-1 ring-black/5 dark:ring-white/10 border border-background shadow-xs` trong cả `task-card.tsx` và `assignee-quick-select.tsx`.

## Artifact
- `src/components/board/task-card.tsx`
- `src/components/board/assignee-quick-select.tsx`

## Quyết định quan trọng
- Viền nổi tinh tế giúp avatar tách biệt rõ ràng khỏi màu nền thẻ mà không cần dùng màu chói.

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Đã tinh chỉnh padding thẻ và avatar.
- watch_out: Không.
- next_inputs: Sẵn sàng cho review.

## Commit
- Hash: chờ commit
- Đã push: không

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
