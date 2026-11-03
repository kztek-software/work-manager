---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 08:20:00deps: [1.1]
---

# STEP 1.2 — Xóa Bỏ Cắt Cụt Chữ Trên Đầu Thẻ Kanban

## Input nhận
- Code tại `src/components/board/task-card.tsx` và ảnh chụp từ người dùng.

## Nhiệm vụ
1. Loại bỏ chuỗi text thừa `· {type.label}` trên hàng đầu thẻ Kanban (vì đã có `TypeIcon` trực quan đại diện cho loại task và tooltip).
2. Tạo độ thoáng cho hàng đầu: Cột trái chỉ gồm `[TypeIcon] #{task.number}`, cột phải hiển thị điểm Story points và Badge Độ ưu tiên.
3. Đảm bảo toàn bộ thẻ Kanban không còn bất kỳ chữ nào bị xén cụt thành `Cô...` hay `Tính ...`.

## Definition of Done
- Không còn bất kỳ hiện tượng cắt cụt chữ trên hàng đầu thẻ Kanban.
- Giao diện thẻ sạch đẹp, chuẩn xác như Linear / Jira.
