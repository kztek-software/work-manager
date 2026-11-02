# Bước 3.7: Active Format Highlight Toàn Diện & Sửa Triệt Để Màu Bị '...' Trong Editor

- **Agent:** Senior Developer
- **Trạng thái:** ✅ Đã hoàn thành (2026-11-02 16:57)
- **Mục tiêu:**
  1. Mở rộng trạng thái Active Format Highlight cho 100% công cụ trên toolbar WYSIWYG:
     - Gạch ngang chữ (Strikethrough - `S`): Nhấn `Ctrl+Shift+X` hoặc khi chọn text có thẻ `<del>`/`<s>` -> nút sáng viền & nền cam KZTEK.
     - Bút dạ quang (Highlighter): Nhấn hoặc chọn text có highlight `<mark>`/`backgroundColor` -> nút sáng viền & nền vàng hổ phách, click lại tự động tắt highlight.
     - Màu chữ (Color Palette): Phát hiện chính xác màu đang chọn tại con trỏ (`foreColor`/`style.color`/`<font>`), đổi màu icon và hiện chấm màu động ở góc icon, nút sáng viền nhấn.
     - Danh sách số (1. 2. 3.): Nhấn hoặc con trỏ trong `<ol>` -> nút sáng viền & nền cam KZTEK.
     - Danh sách gạch đầu dòng (•): Nhấn hoặc con trỏ trong `<ul>` -> nút sáng viền & nền cam KZTEK.
     - Tiêu đề (H): Đổi nhãn nút thành H1/H2/H3 và sáng viền nhấn khi con trỏ ở tiêu đề; bên trong dropdown hiện dấu tích `✓` và nền nhấn tại tiêu đề tương ứng.
     - Trích dẫn (`""` / Blockquote): Sáng viền nhấn khi ở trong `<blockquote>`, click lại tự động đưa về `<p>`.
     - Khối mã (`<>` / Code): Sáng viền nhấn khi ở trong `<pre>`/`<code>`, click lại tự động đưa về `<p>`.
  2. Sửa triệt để lỗi bảng màu bị cắt chữ `...` (`Đỏ`, `Xa...`, `Xa...`, `Và...`, `Hồ...`):
     - Mở rộng menu màu từ `w-64` (chật chội) sang `w-72` (288px) với layout 2 cột rộng rãi.
     - Hiển thị đầy đủ tên tiếng Việt không bao giờ bị cắt: `Đỏ`, `Xanh lá`, `Xanh dương`, `Vàng cam`, `Tím`, `Hồng`, `Xám`.
     - Màu đang được áp dụng tại vị trí con trỏ sẽ có dấu tích `✓`, viền cam nhấn và nền nổi bật `bg-accent/20 border-accent text-accent`.
     - Nút "Mặc định" có dấu tích `✓` khi không áp dụng màu.
  3. Áp dụng đồng bộ cho cả `WysiwygEditor` và `RichTextToolbar`.
