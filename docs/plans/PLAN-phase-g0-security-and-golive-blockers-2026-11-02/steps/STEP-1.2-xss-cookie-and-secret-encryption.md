---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: todo
completed_at:
deps: [1.1]
---

# STEP 1.2 — Chống XSS `DOMPurify`, Cookie `httpOnly` (LAN/HTTPS) & Mã hóa Secrets AES-256-GCM (`G0-2` & `G0-3`)

## Input nhận
- Handoff Payload từ `STEP-1.1` (Auth/RBAC đã được dựng vững chắc).

## Nhiệm vụ
1. Cài đặt / tích hợp `isomorphic-dompurify` làm Seam trung tâm tại `src/lib/sanitize.ts`.
2. Áp dụng `sanitizeHtml` cho `src/components/ui/rich-markdown.tsx` và `src/components/ui/wysiwyg-editor.tsx`, cấu hình cho phép các thẻ an toàn (b, i, u, s, span, font, mark, p, h1-h3, ul, ol, li, blockquote, pre, code, a, table) và attributes (style, color, href, target), triệt tiêu hoàn toàn `<script>`, `<svg onload>`, `<img onerror>`, `javascript:`.
3. Escape HTML trong `src/lib/mail.ts` và kích hoạt `rejectUnauthorized: true` mặc định cho kết nối SMTP TLS.
4. Cấu hình cookie phiên `flowboard_session` trong `src/lib/auth.ts`: bắt buộc `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.COOKIE_SECURE === "true"` (đảm bảo chạy cả HTTP LAN lẫn HTTPS). Đồng bộ client fetch credentials `same-origin` trong `src/lib/tab-cache.ts` và `src/app/board/board-view.tsx`.
5. Tạo `src/lib/crypto-secrets.ts` sử dụng thuật toán `AES-256-GCM` để mã hóa/giải mã các trường bí mật.
6. Cập nhật `src/lib/system-config.ts` và `src/app/api/system/config/route.ts`:
   - 8 trường nhạy cảm (`smtpPass`, `zaloSecretKey`, `zaloRefreshToken`, `discordWebhookUrl`, v.v.) khi lưu vào DB `SystemSetting` hoặc file backup JSON đều được mã hóa dưới dạng `enc:v1:...`.
   - `GET /api/system/config` luôn trả về chuỗi mặt nạ `******` cho các trường có giá trị.
   - Hàm `POST /api/system/config` xóa bỏ `console.log(body)` và kiểm tra SSRF trên `discordWebhookUrl` (chỉ cho phép domain discord.com).
7. Xóa `cookies.txt` khỏi Git và bổ sung vào `.gitignore`.

## Definition of Done
- [ ] XSS payloads `<script>`, `<svg onload>`, `<img onerror>` bị lọc sạch 100% trong cả Markdown preview lẫn WYSIWYG editor.
- [ ] Cookie `flowboard_session` mang cờ `HttpOnly; SameSite=Lax`. Đăng nhập hoạt động mượt mà cả LAN HTTP và HTTPS.
- [ ] `GET /api/system/config` không lộ plaintext passwords/secrets. Secret trong DB được mã hóa AES-256-GCM.
- [ ] Không còn `console.log` secret ra container stdout.
- [ ] `cookies.txt` không còn tồn tại trong repo và đã có trong `.gitignore`.

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
