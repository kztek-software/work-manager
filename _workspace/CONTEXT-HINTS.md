# CONTEXT-HINTS: kanban-ui-ux-polishing (WF-FASTTRACK | P3)
## 1. Modules chính cần thay đổi
- **Board Columns Layout**: `src/components/board/board-column.tsx` (header padding, min-width, internal scrollbar)
- **Board View Container**: `src/app/board/board-view.tsx` (gap giữa các cột, padding bao quanh)
- **Task Card Component**: `src/components/board/task-card.tsx` (card internal padding, footer spacing, avatar frame)
- **Assignee Quick Select**: `src/components/board/assignee-quick-select.tsx` (avatar frame styling)
## 2. Skills & Gotchas khuyến nghị
- Tra `GOTCHAS.md` G013 khi chạy build/tsc: Thêm `$env:PATH = "C:\Users\Admin\node\PFiles64\nodejs;$env:PATH"`.
- Đảm bảo thanh cuộn mượt mà không che lấp nội dung thẻ task trên màn hình nhỏ.
## 3. Điểm UNCERTAIN & Lưu ý
- Giữ nguyên các handler kéo thả DnD-Kit (`useDroppable`, `SortableContext`), chỉ can thiệp vào styling (Tailwind CSS classes).
