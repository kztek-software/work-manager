---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: in_progress
completed_at:
deps: []
---

# STEP 1.1 — Auth/RBAC Guard, Đóng tự đăng ký & Vòng đời Token (`G0-1` & `G0-5`)

## Input nhận
- Căn cứ `docs/architecture/ADR-001-system-architecture-roadmap.md` và `docs/architecture/ARCH-AUDIT-system-2026-11-02.md`
- Quyết định: Đóng tự đăng ký công khai (`/api/auth/register`), chỉ Admin được tạo user; Cookie session tương thích cả HTTP LAN (`COOKIE_SECURE=false`) và HTTPS Internet.

## Nhiệm vụ
1. Thêm trường `tokenVersion Int @default(1)` vào model `User` trong `prisma/schema.prisma`. Chạy `npx prisma db push` và `npx prisma generate` (lưu ý GOTCHAS G010).
2. Chuyển đổi `hashPassword` và `verifyPassword` trong `src/lib/auth.ts` từ `scryptSync` sang `crypto.scrypt` async non-blocking. Đưa `tokenVersion` vào payload JWT và kiểm tra `tokenVersion` khi verify session/token.
3. Tạo `src/lib/api-guard.ts` cung cấp higher-order wrapper `withApiAuth(handler, { requiredRole, requiredPermission })` kiểm tra session, kiểm tra `tokenVersion` khớp với DB, và kiểm tra cờ `mustChangePassword` (chặn `403 PASSWORD_CHANGE_REQUIRED` nếu truy cập các API khác ngoài `change-password` và `logout`).
4. Khởi tạo `src/proxy.ts` (chuẩn Next.js 16 theo docs `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) bảo vệ các route `/admin/**`, `/api/users/**`, `/api/system/**`.
5. Bảo vệ chặt chẽ các API quản trị người dùng:
   - `src/app/api/users/route.ts`: Chỉ `ADMIN` được tạo user (`POST`) và xem toàn bộ danh sách phân quyền.
   - `src/app/api/users/[userId]/route.ts`: Chỉ `ADMIN` được `PATCH`/`DELETE` hoặc chỉnh sửa role của user.
   - `src/app/api/auth/register/route.ts`: Khóa đăng ký công khai (trả `403 Registration is closed`).
   - Ẩn/khóa đường dẫn tự đăng ký trên UI `src/app/login/page.tsx` và thông báo tài khoản do Admin cấp tại `src/app/register/page.tsx`.
6. Bảo vệ quyền truy cập tài nguyên:
   - `src/app/api/attachments/[id]/route.ts`: Bắt buộc auth và kiểm tra quyền sở hữu/quyền project trước khi xóa (`DELETE`).
   - `src/app/api/tickets/[ticketId]/route.ts`: Ẩn `internalNotes` và comment nội bộ đối với user ẩn danh / khách hàng.
   - `src/app/api/tickets/[ticketId]/comments/route.ts`: Chặn khách hàng/user ẩn danh giả mạo `isStaff: true`.
   - `src/app/api/notifications/email-logs/route.ts`: Chỉ `ADMIN` mới được xem/xóa log email hệ thống.
7. Đổi mật khẩu thành công (`src/app/api/auth/change-password/route.ts`) -> tăng `tokenVersion` để thu hồi toàn bộ token/session cũ.

## Definition of Done
- [ ] Model `User` có `tokenVersion` trong DB PostgreSQL và `prisma generate` thành công.
- [ ] `scrypt` async hoạt động mượt mà, không block Event Loop khi login.
- [ ] User ẩn danh gọi `POST /api/users`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]`, `DELETE /api/attachments/[id]`, `/api/notifications/email-logs` đều nhận `401` hoặc `403`.
- [ ] `/api/auth/register` từ chối đăng ký công khai; UI `/login` và `/register` đã ẩn/khóa form tự đăng ký tự do.
- [ ] `/api/tickets/[ticketId]` ẩn danh không xem được `internalNotes`; không thể inject `isStaff: true`.
- [ ] Đổi mật khẩu vô hiệu hóa ngay lập tức token cũ.

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
