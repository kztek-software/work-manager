# Bước 3.6: Fix Render HTML Mô Tả Chi Tiết, Active Format Highlight Trong WYSIWYG & Nâng Chiều Cao Tap/Click Targets

- **Agent:** Senior Developer
- **Trạng thái:** ✅ Đã hoàn thành (2026-11-02 16:45)
- **Mục tiêu:**
  1. Hiển thị chuẩn xác HTML (`<br>`, entity `&nbsp;`, `&gt;`, `&lt;`) trong khung xem trước mô tả chi tiết của Task (`RichMarkdown`).
  2. Bổ sung trạng thái Active Format Highlight trong thanh công cụ WYSIWYG Editor (`WysiwygEditor`):
     - Khi nhấn phím tắt Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X hoặc đặt con trỏ tại dòng danh sách số (1. 2. 3.), gạch đầu dòng (•), trích dẫn, code block, tiêu đề (H1, H2, H3), nút tương ứng trên toolbar sẽ sáng lên với viền và nền nhấn (`bg-accent/20 text-accent font-bold ring-1 ring-accent/40 shadow-xs`).
     - Bổ sung `onMouseDown={(e) => e.preventDefault()}` cho toàn bộ nút toolbar để tránh mất focus/selection trong editor.
     - Tăng kích thước nút toolbar từ `h-7 min-w-[28px]` lên `h-8 min-w-[32px] px-2 rounded-lg`.
  3. Nâng chiều cao và padding cho toàn bộ interactive elements (buttons, links, selects) bị thấp/dẹt trên UI:
     - Nút `+ Tải tệp lên` (`project-attachment-gallery.tsx`) từ `h-7.5` lên `h-9 px-4 rounded-xl text-xs sm:text-sm font-bold`.
     - Link `Báo cáo KPI ↗` và `Mở Board ↗` (`dashboard/page.tsx`) từ `px-2 py-0.5 text-[10px]` lên `h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5`.
     - Nút `Chi tiết` sprint (`dashboard/page.tsx`) từ `h-7.5` lên `h-8.5 px-3.5 rounded-xl font-bold text-xs`.
     - Input & Button thêm Subtask (`task-dialog.tsx`) từ `h-7.5` lên `h-8.5 rounded-xl`.
     - Input ngày tháng, Story points, Người liên hệ, SĐT, Kế hoạch Sprint (`task-dialog.tsx`) từ `h-7.5` lên `h-8.5 rounded-xl`.
     - Toolbar nút & bộ lọc Board (`board-view.tsx`) từ `h-7 sm:h-7.5` lên `h-8.5 sm:h-9 rounded-xl`.
     - Nút Gửi comment trong Ticket Drawer (`ticket-drawer.tsx`) từ `h-7` lên `h-8.5 px-3.5 rounded-xl`.
     - Role dropdown trong Member Dialog (`member-dialog.tsx`) từ `h-7.5` lên `h-8.5 rounded-xl`.
     - Nút tải tệp đính kèm Task (`task-attachment-gallery.tsx`) từ `h-7.5` lên `h-8.5 rounded-xl`.
