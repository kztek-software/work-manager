---
step: 3.1
plan: ../PLAN-MASTER.md
agent: qa-engineer
status: todo
completed_at:
deps: [2.2]
---

# STEP 3.1 — Kiểm thử Nghiệm thu 10 Chốt chặn Gate 1 trên Ứng dụng Thật

## Input nhận
- Code đã qua review của Tech Lead và UX/UI Reviewer từ `STEP-2.1` và `STEP-2.2`.

## Nhiệm vụ
1. Viết kịch bản kiểm thử tự động `scripts/test_gate1_security.ts` kiểm tra toàn bộ 10 tiêu chí an ninh của Gate 1:
   - #1: Thử nghiệm user ẩn danh và user thường gọi `/api/users/**`, `/api/auth/register`, `/api/attachments/[id]`, `/api/notifications/email-logs` -> Xác nhận nhận `401` hoặc `403`.
   - #2: Thử nghiệm truy vấn `/api/tickets/[ticketId]` ẩn danh -> Xác nhận không lộ `internalNotes`. Thử gửi `isStaff: true` -> Xác nhận bị chặn.
   - #3: Gửi payload XSS độc hại (`<script>`, `<svg onload>`, `<img onerror>`) vào task description và comment -> Xác nhận khi render không bị kích hoạt script. Kiểm tra cookie phiên có `HttpOnly; SameSite=Lax`.
   - #4: Gọi `GET /api/system/config` -> Xác nhận chỉ thấy `******`. Kiểm tra DB `SystemSetting` -> xác nhận dữ liệu đã được mã hóa AES-256-GCM.
   - #5: Gửi 15 request login liên tiếp -> Xác nhận bị chặn `429 Too Many Requests`. Thử upload file `.html`, `.svg` -> Xác nhận bị chặn `400/415`.
   - #6: Đăng nhập nhận token A, đổi mật khẩu -> thử dùng token A -> Xác nhận bị từ chối `401/403` do lệch `tokenVersion`.
   - #7: Truy cập `/desktop`, thực hiện tạo task và cập nhật trạng thái -> Xác nhận hoạt động thành công `200 OK`. Bắn đồng thời 10 request tạo task -> Xác nhận không dính lỗi `P2002`.
2. Chạy ứng dụng thật và thực thi script kiểm thử; kiểm tra thêm các luồng hồi quy trên Kanban Board và MyWork.
3. Xuất báo cáo kiểm thử `docs/test-cases/QA-REPORT-gate1-2026-11-02.md`.

## Definition of Done
- [ ] Script `scripts/test_gate1_security.ts` chạy thành công và pass 100% các chốt chặn Gate 1.
- [ ] Không phát hiện lỗi P0 hoặc P1 mới nào.
- [ ] Báo cáo `QA-REPORT-gate1-2026-11-02.md` hoàn tất (+ `.docx`, `.pdf` theo Rule R1).

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
