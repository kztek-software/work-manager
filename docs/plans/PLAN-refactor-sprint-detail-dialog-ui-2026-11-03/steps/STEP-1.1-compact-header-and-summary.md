---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 07:22:00deps: []
---

# STEP 1.1 — Sửa Header, Loại Bỏ Duplicate Badge & Tinh Gọn Goal/Workload

## Input nhận
- Ảnh chụp từ người dùng và file `src/components/sprint/sprint-detail-dialog.tsx`.
- Hai badge `Đã hoàn thành` xuất hiện cạnh nhau do `timeInfo.statusLabel` gán trùng chuỗi trạng thái khi `sprint.status === "COMPLETED"`.
- Vùng Header + Goal + Assignee Workload chiếm quá nhiều diện tích dọc.

## Nhiệm vụ
1. **Header Badges**:
   - Chỉ hiển thị duy nhất 1 status badge (`Đã hoàn thành` / `Đang hoạt động` / `Đang lên kế hoạch`).
   - `timeInfo`: Nếu `sprint.status === "COMPLETED"`, chỉ hiển thị thông tin thời lượng (ví dụ: `14 ngày` hoặc khoảng ngày) hoặc không lặp lại `⏳ Đã hoàn thành`.
   - Nếu `ACTIVE`: hiển thị ngày còn lại `⏳ Còn X ngày` hoặc `Đã quá hạn Y ngày`.
2. **Goal & Date Bar**:
   - Thiết kế tinh gọn, thanh thoát, giảm padding quá đà.
3. **Assignee Workload Summary**:
   - Tối ưu kích thước card nhân sự, giữ độ rõ nét nhưng không chiếm quá nhiều pixel chiều cao.

## Definition of Done
- Không còn hiện tượng 2 badge "Đã hoàn thành" cạnh nhau.
- Vùng header gọn gàng, chừa tối đa diện tích dọc cho danh sách công việc.
