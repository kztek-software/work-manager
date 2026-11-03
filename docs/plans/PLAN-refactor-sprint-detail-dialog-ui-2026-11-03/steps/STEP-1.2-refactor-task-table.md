---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 07:22:00deps: [1.1]
---

# STEP 1.2 — Thiết Kế Lại Task Table: Mở Rộng Tiêu Đề, Clean Status & Labels

## Input nhận
- Task table hiện tại bị bóp nghẹt: Tiêu đề công việc chỉ hiển thị ~18 ký tự rồi cắt `...`.
- Nhãn bị co cụm thành `comp:...`, `tech:...`.
- Dropdown trạng thái ở mỗi dòng là full widget cồng kềnh (130px).

## Nhiệm vụ
1. **Tái phân bổ Grid Column**:
   - Đồng bộ chính xác Grid giữa Header và Body (`grid-cols-[...]`).
   - Cột Tiêu đề công việc chuyển sang layout linh hoạt (ưu tiên tối đa chiều rộng `min-w-0 flex-1`), cho phép tên task dài hiển thị thoải mái hoặc dùng 2 dòng nếu dài (`line-clamp-2` thay vì cắt cụt 15 ký tự).
2. **Cột Nhãn (Labels)**:
   - Hiển thị pill nhỏ gọn, màu sắc tinh tế, chiều rộng hợp lý (`max-w-[120px]` thay vì `max-w-[60px]`), hoặc gom gọn thông minh nếu có nhiều nhãn.
3. **Cột Trạng Thái (Status)**:
   - Thay thế full PrimeReact Dropdown bằng Status Badge Pill tinh tế:
     - Hiển thị nhãn trạng thái với màu tương ứng (`bg`, `color`, `border`) từ `statusMeta(status)`.
     - Click vào mở menu trạng thái nhanh hoặc native compact select, không chiếm dụng 130px diện tích cố định.
4. **Cột Mã Task & Điểm & Người phụ trách**:
   - Tối ưu căn chỉnh, font-mono gọn ghẽ, avatar người phụ trách thanh lịch.
   - Khi task `DONE`, dùng màu dịu hơn thay vì gạch chữ thô ráp làm mất khả năng đọc.

## Definition of Done
- Tiêu đề task hiển thị rõ ràng, trọn vẹn nội dung nghiệp vụ.
- Không còn nhãn bị cắt thành `comp:...`.
- Giao diện bảng đạt độ hoàn thiện cao, tương đương Jira/Linear.
