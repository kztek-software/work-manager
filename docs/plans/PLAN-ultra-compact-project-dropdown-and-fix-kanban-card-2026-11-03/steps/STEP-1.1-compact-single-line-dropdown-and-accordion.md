---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 08:20:00deps: []
---

# STEP 1.1 — Single-Line Compact Row & Collapsible Groups trong Sidebar Dropdown

## Input nhận
- Code tại `src/components/app-shell.tsx`.

## Nhiệm vụ
1. Thêm state `collapsedProjectGroups` cho phép lưu trữ trạng thái thu gọn / mở rộng từng nhóm trạng thái (`ACTIVE`, `PLANNING`, `COMPLETED`).
2. Header nhóm biến thành nút bấm toggle, kèm icon `ChevronDown` xoay mượt mà và số lượng dự án trong nhóm.
3. Chuyển đổi mỗi dòng dự án thành hàng đơn thanh lịch (Single-Line Compact Row):
   - Kích thước dòng giảm từ ~54px xuống ~32px.
   - Mini avatar 20px + Tên dự án trọn vẹn (truncate) + Mã Key nằm cạnh trên cùng dòng + Dấu tích chọn active tinh gọn.

## Definition of Done
- Chiều cao dropdown giảm gần 50%, hiển thị được nhiều dự án hơn gấp đôi mà không tràn cuộn.
- Nhóm trạng thái bấm thu gọn/mở rộng mượt mà.
