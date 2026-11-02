---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-02 20:41
deps: []
---

# STEP 1.1 — Tối ưu Khoảng cách Cột & Scrollbar

## Input nhận
Từ PLAN-MASTER: Khoảng cách giữa các cột Kanban và cấu trúc cuộn thẻ bên trong từng cột cần được hoàn thiện thoáng đãng hơn.

## Nhiệm vụ
- Cập nhật `src/components/board/board-column.tsx`:
  - Mở rộng padding Header cột: `px-2 py-1.5 mb-1.5`.
  - Cân chỉnh độ rộng tối thiểu của cột `min-w-[230px] md:min-w-[245px]` và padding `p-2 sm:p-2.5`.
  - Vùng task list: `space-y-2 pr-1`, hỗ trợ thanh cuộn êm ái khi danh sách task dài.
- Cập nhật `src/app/board/board-view.tsx`:
  - Tinh chỉnh container chứa 5 cột: `gap-3 sm:gap-3.5 md:gap-4`, padding xung quanh `p-2.5 sm:p-3 md:p-3.5 px-3 sm:px-4 pb-3`.

## Definition of Done
- [x] Các cột dàn đều cân đối, không bị ép hẹp.
- [x] Cuộn mượt mà không che lấp thẻ task cuối cùng.

## Đã làm
- Cập nhật `board-column.tsx` nâng padding header lên `px-2 py-1.5 mb-1.5` và tăng khoảng cách thẻ lên `space-y-2`.
- Cập nhật `board-view.tsx` giãn khoảng cách giữa các cột lên `gap-3 sm:gap-3.5 md:gap-4`.

## Artifact
- `src/components/board/board-column.tsx`
- `src/app/board/board-view.tsx`

## Quyết định quan trọng
- Giữ tỷ lệ co giãn linh hoạt trên mobile và tablet trong khi đảm bảo độ thoáng đạt trên màn hình lớn.

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Đã tối ưu spacing và layout cột Kanban.
- watch_out: Không.
- next_inputs: `src/components/board/board-column.tsx`, `src/app/board/board-view.tsx`.

## Commit
- Hash: chờ commit cùng Step 1.2
- Đã push: không

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
