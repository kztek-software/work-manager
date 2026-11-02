# CONTEXT-HINTS: phase-g0-security-and-golive-blockers (WF-HOTFIX | P0/P1)
## 1. Modules trọng tâm cần xử lý (G0-1 → G0-6)
- **Auth, RBAC & Session (G0-1, G0-5)**: `prisma/schema.prisma` (`tokenVersion`), `src/lib/auth.ts`, `src/lib/api-guard.ts` (`withApiAuth`), `src/proxy.ts`, `src/app/api/users/**`, `src/app/api/auth/**`, `src/app/login/page.tsx`, `src/app/register/page.tsx`
- **Resource Access Control (G0-1)**: `src/app/api/attachments/**`, `src/app/api/tickets/[ticketId]/route.ts`, `src/app/api/tickets/[ticketId]/comments/route.ts`, `src/app/api/notifications/email-logs/route.ts`
- **XSS, Cookie & Crypto Secrets (G0-2, G0-3)**: `src/components/ui/rich-markdown.tsx`, `src/components/ui/wysiwyg-editor.tsx`, `src/lib/mail.ts`, `src/lib/tab-cache.ts`, `src/lib/system-config.ts`, `src/app/api/system/config/route.ts`, `cookies.txt`
- **Rate-Limit, Upload & Webhook (G0-4)**: `src/lib/rate-limit.ts`, `src/app/api/upload/route.ts`, `src/app/api/tickets/public/route.ts`, `src/app/api/integrations/zalo/webhook/route.ts`, `next.config.ts`
- **Desktop Fix, Atomic Task & Infra (G0-6)**: `src/app/desktop/page.tsx`, `src/app/api/projects/[projectId]/tasks/route.ts`, `src/app/api/health/route.ts`, `docker-compose.yml`, `scripts/backup-postgres.*`
## 2. Skills bắt buộc theo bước
- `verify-pr` (`.gemini/commands/verify-pr.md`): Senior Dev chạy build/lint/test & đính kèm VERIFICATION REPORT trước Tech Lead review.
- `security-audit-stride` + `code-review` (`.gemini/commands/`): Tech Lead kiểm định lại OWASP Top 10 & STRIDE trước khi bàn giao UXR/QA.
## 3. Ràng buộc kỹ thuật & GOTCHAS bắt buộc lưu ý
- **[NEXT16-PROXY]** Đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` trước khi viết `src/proxy.ts` (`AGENTS.md`).
- **[PRISMA-G010]** Khi thêm `User.tokenVersion` vào `schema.prisma`, chạy `prisma db push` + `prisma generate` và kiểm tra singleton `src/lib/prisma.ts` (G010).
- **[COOKIE-LAN]** Bắt buộc `httpOnly: true`, `sameSite: "lax"`, giữ `secure: process.env.COOKIE_SECURE === "true"` để tương thích cả HTTP LAN & HTTPS.
- **[REGISTER-CLOSED]** Khóa tự đăng ký công khai trên `/api/auth/register` (chỉ `ADMIN` tạo tài khoản) và ẩn/chặn luồng `/register` công khai trên UI.
- **[RULES-R1-R3]** Cập nhật `code-graph/CODE-GRAPH.md` sau khi sửa code (R3); xuất tài liệu qua `python scripts/md_to_docx_kztek.py <file>` (xem G005).
