---
step: 2.2
plan: ../PLAN-MASTER.md
agent: ux-ui-reviewer
status: todo
completed_at:
deps: [2.1]
---

# STEP 2.2 — Đánh giá Trực quan Giao diện Thực tế trên Ứng dụng Thật (C1–C7)

## Input nhận
- Code đã qua review của Tech Lead từ `STEP-2.1`.

## Nhiệm vụ
1. Khởi chạy ứng dụng thật và truy cập trực tiếp bằng trình duyệt.
2. Kiểm tra trực quan và chụp ảnh screenshot thực tế tại:
   - Màn hình `/login` & `/register` sau khi đóng form tự đăng ký tự do.
   - Soạn thảo `WysiwygEditor` và hiển thị `RichMarkdown` trong `TaskDialog` (kiểm tra màu sắc, format đậm/nghiêng/gạch chân, danh sách số/bullet có bị vỡ sau khi bọc DOMPurify không).
   - Màn hình không gian làm việc máy tính `/desktop`: kiểm tra mở task, tạo task mới và đổi trạng thái.
3. Lưu toàn bộ ảnh chụp vào thư mục `docs/ux-review/screenshots/2026-11-02-gate1/`.
4. Đánh giá chi tiết theo 7 tiêu chí C1–C7 và lập báo cáo `docs/ux-review/UX-REVIEW-phase-g0-2026-11-02.md`.

## Definition of Done
- [ ] Chạy ứng dụng thật, chụp ảnh screenshot đầy đủ 4 khu vực giao diện thay đổi.
- [ ] Báo cáo `UX-REVIEW-phase-g0-2026-11-02.md` đạt chuẩn C1–C7 (+ `.docx`, `.pdf` theo Rule R1).

## Đã làm


## Artifact


## Quyết định quan trọng


## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo:
- watch_out:
- next_inputs:

## Commit
- Hash:
- Đã push:

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
