---
step: 1.3
plan: ../PLAN-MASTER.md
agent: senior-developer
status: todo
completed_at:
deps: [1.2]
---

# STEP 1.3 — Rate-Limiter, An toàn Upload, Vá `/desktop` 404, Atomic `Task.number` & `/verify-pr` (`G0-4` & `G0-6a`)

## Input nhận
- Handoff Payload từ `STEP-1.2`.

## Nhiệm vụ
1. Tạo module `src/lib/rate-limit.ts` (in-memory token bucket / sliding window per IP):
   - `/api/auth/login`: tối đa 10 requests / phút.
   - `/api/tickets/public`: tối đa 5 requests / phút.
   - `/api/upload`: tối đa 20 requests / phút.
2. Củng cố an toàn cho `src/app/api/upload/route.ts`:
   - Bắt buộc người dùng phải đăng nhập hợp lệ trước khi upload file.
   - Chặn tuyệt đối các tệp thực thi web nguy hiểm: `.html`, `.htm`, `.svg`, `.js`, `.xhtml`, `.php`, `.exe`, `.bat`, `.sh`.
   - Kiểm tra magic bytes của các tệp ảnh và tài liệu thông dụng.
   - Cấu hình response headers `X-Content-Type-Options: nosniff` và `Content-Security-Policy: default-src 'none'` cho thư mục `/uploads/*` trong `next.config.ts`.
3. Bảo vệ Zalo Webhook (`src/app/api/integrations/zalo/webhook/route.ts`): Bắt buộc kiểm tra token / `oaSecretKey` trước khi tiếp nhận payload.
4. Khắc phục lỗi 404 trên `/desktop`:
   - Sửa route gọi trong `src/app/desktop/page.tsx`: đổi `PATCH /api/tasks/${taskId}` thành route chuẩn `PATCH /api/projects/${projectId}/tasks/${taskId}`.
   - Xử lý đúng cấu trúc JSON response trả về khi tạo task mới (`{ task }`).
5. Đảm bảo tính nguyên tử (Atomic) khi sinh `Task.number` trong `src/app/api/projects/[projectId]/tasks/route.ts`: Bọc câu lệnh tìm `max(number)` và `task.create` bên trong `prisma.$transaction` có cơ chế retry khi gặp mã lỗi `P2002` (Unique constraint failed on `projectId_number`).
6. Tạo endpoint kiểm tra sức khỏe hệ thống `src/app/api/health/route.ts` (`GET` trả về status, kết nối DB PostgreSQL, uptime).
7. Cập nhật `code-graph/CODE-GRAPH.md` phản ánh đúng PostgreSQL 17 và các module mới theo Rule R3.
8. Chạy `/verify-pr` kiểm tra build và lint, đính kèm `VERIFICATION REPORT` đạt 100% PASS.

## Definition of Done
- [ ] Gửi request login sai quá 10 lần bị trả về `429 Too Many Requests`.
- [ ] Upload file `.html` hoặc `.svg` bị từ chối ngay lập tức.
- [ ] Giao diện `/desktop` tạo task và cập nhật trạng thái hoạt động trơn tru (HTTP 200), không còn lỗi 404.
- [ ] Bắn nhiều request tạo task đồng thời không bị trùng mã hoặc crash do `P2002`.
- [ ] `/api/health` phản hồi `200 { status: "ok", db: "connected" }`.
- [ ] `code-graph/CODE-GRAPH.md` được cập nhật, xuất file PDF/DOCX thành công.
- [ ] `/verify-pr` toàn bộ PASS.

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
