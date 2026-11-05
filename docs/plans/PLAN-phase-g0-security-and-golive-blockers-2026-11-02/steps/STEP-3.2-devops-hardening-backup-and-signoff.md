---
step: 3.2
plan: ../PLAN-MASTER.md
agent: devops-lead
status: done
completed_at: 2026-11-03 07:15
deps: [3.1]
---

# STEP 3.2 — Cứng hóa Docker, Diễn tập Backup/Restore & Sign-off Gate 1

## Input nhận
- Báo cáo kiểm thử PASS 100% từ QA Engineer tại `STEP-3.1` (`docs/test-cases/QA-REPORT-gate1-2026-11-02.md` với 53/53 test cases đạt).
- Báo cáo kiểm định an ninh OWASP/STRIDE từ Tech Lead (`docs/architecture/SECURITY-AUDIT-gate1-2026-11-02.md`).
- Báo cáo nghiệm thu giao diện C1–C7 từ UX/UI Reviewer (`docs/ux-review/UX-REVIEW-phase-g0-2026-11-02.md`).

## Nhiệm vụ
1. Cập nhật `docker-compose.yml`:
   - Bind cổng PostgreSQL `127.0.0.1:${POSTGRES_PORT:-5432}:5432` thay vì phơi mở toàn bộ interface `0.0.0.0`.
   - Cấu hình `healthcheck` cho service `app` sử dụng endpoint `/api/health`.
   - Khởi tạo và gắn volume dữ liệu `app-data:/app/data` (bảo vệ tệp `system-config.json`).
2. Xây dựng bộ script sao lưu CSDL PostgreSQL định kỳ `scripts/backup-postgres.sh` và `scripts/backup-postgres.ps1` (lưu file `.ps1` có UTF-8 BOM theo G002).
3. Thực hiện diễn tập sao lưu `pg_dump` thực tế và chạy kiểm thử khôi phục (restore drill) trên CSDL thử nghiệm độc lập, xác nhận tính toàn vẹn 100% của dữ liệu sao lưu.
4. Xác nhận tình trạng đóng băng bộ cài C# Mobile cũ theo chỉ đạo của ADR-001 (Tiêu chí #9).
5. Tổng hợp biên bản và ký quyết định mở Cổng Golive Tier-1 (Mạng LAN Nội bộ KZTEK / VPN): `docs/architecture/GATE1-SIGNOFF-2026-11-02.md` (+ `.docx`, `.pdf` theo Rule R1).

## Definition of Done
- [x] `docker-compose.yml` được cấu hình bảo mật đúng chuẩn (loopback bind, healthcheck, app-data volume).
- [x] Script sao lưu tự động hoạt động mượt mà; diễn tập khôi phục DB thành công 100% (21/21 bảng khớp dữ liệu).
- [x] Hoàn tất `docs/architecture/GATE1-SIGNOFF-2026-11-02.md` (+ `.docx`, `.pdf` theo Rule R1).
- [x] Gate 1 được nghiệm thu và mở thành công (Mở Golive Tier-1 LAN Pilot).

## Đã làm
1. **Cứng hóa Hạ tầng `docker-compose.yml` (`G0-6`):**
   - Đổi cấu hình port PostgreSQL: `"127.0.0.1:${POSTGRES_PORT:-5432}:5432"`, ngăn ngừa việc phơi cổng CSDL ra mạng ngoài.
   - Bổ sung `healthcheck` cho service `app`: `wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1` (interval 15s, timeout 5s, retries 3, start_period 20s).
   - Thêm mount volume `app-data:/app/data` cho container `app` và khai báo top-level volume `app-data:`, đảm bảo cấu hình hệ thống `data/system-config.json` không bị mất khi redeploy container.
2. **Xây dựng Bộ Script Sao lưu CSDL PostgreSQL:**
   - Tạo `scripts/backup-postgres.sh`: Shell script cho Linux/Docker host, hỗ trợ nén `gzip -9`, tự động phân giải cấu hình `.env`, dọn dẹp bản backup cũ quá 14 ngày.
   - Tạo `scripts/backup-postgres.ps1`: PowerShell script cho Windows Server, lưu chuẩn UTF-8 BOM (`\xef\xbb\xbf`) theo GOTCHAS G002, tự động tìm `pg_dump.exe`, nén native .NET GZipStream và dọn dẹp retention 14 ngày.
   - Chạy thử `backup-postgres.ps1` tạo bản sao lưu thực tế `backup_WorkingManager_20261103_070642.sql.gz` (22.02 KB nén, 97.83 KB thô).
3. **Diễn tập Sao lưu & Khôi phục CSDL Thực tế (Restore Drill — Tiêu chí #8):**
   - Xây dựng `scripts/test_restore_drill.ts`:
     - Tự động tìm và giải nén tệp sao lưu mới nhất.
     - Khởi tạo CSDL thử nghiệm độc lập `WorkingManager_RestoreTest`.
     - Thực thi nạp toàn bộ cấu trúc và dữ liệu từ dump vào CSDL thử nghiệm bằng `psql`.
     - Kiểm tra và đối chiếu số bản ghi 100% khớp dữ liệu gốc: User (4/4), Project (5/5), Task (75/75), CustomerTicket (0/0), SystemSetting (1/1), ProjectMember (18/18), Activity (26/26).
     - Khôi phục đầy đủ 21/21 bảng dữ liệu trong 0.60 giây.
     - Tự động giải phóng và dọn dẹp an toàn CSDL thử nghiệm.
4. **Kiểm tra Đóng băng Client Mobile Cũ (Tiêu chí #9):**
   - Quét toàn bộ thư mục `public/`, xác nhận không có bất kỳ tệp binary cài đặt di động nào (`.apk`, `.ipa`, `.aab`, `.exe`, `.msi`) được phân phối công khai.
5. **Ban hành Biên bản Nghiệm thu Gate 1 & Ký Quyết định Mở Cổng Tier-1 LAN:**
   - Biên soạn đầy đủ `docs/architecture/GATE1-SIGNOFF-2026-11-02.md` tổng kết 10/10 tiêu chí đạt PASS 100%.
   - Ký phê duyệt chính thức gỡ bỏ lệnh `🛑 BLOCK GOLIVE`, mở cổng Golive Tier-1 LAN Pilot.
   - Biên dịch tự động sang DOCX và PDF theo Rule R1.

## Artifact
- `docker-compose.yml`
- `scripts/backup-postgres.sh`
- `scripts/backup-postgres.ps1`
- `scripts/test_restore_drill.ts`
- `backups/postgres/backup_WorkingManager_20261103_070642.sql.gz`
- `docs/architecture/GATE1-SIGNOFF-2026-11-02.md`
- `docs/architecture/GATE1-SIGNOFF-2026-11-02.docx`
- `docs/architecture/GATE1-SIGNOFF-2026-11-02.pdf`

## Quyết định quan trọng
- **Chính thức mở Cổng Golive Tier-1 (Mạng LAN Nội Bộ KZTEK / VPN):** Toàn bộ CBNV KZTEK được phép sử dụng Web App và Desktop PWA trên môi trường mạng nội bộ doanh nghiệp.
- **Duy trì đóng cổng Public Internet (Tier-2):** Cổng `/portal` tiếp tục được cô lập cho đến khi hoàn thành Phase G1 (Gate 2).

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Cứng hóa `docker-compose.yml`, script sao lưu định kỳ, diễn tập khôi phục CSDL, ký ban hành `GATE1-SIGNOFF`.
- watch_out: Khi triển khai máy chủ Windows, luôn kích hoạt Task Scheduler với tài khoản có quyền đọc ghi thư mục `backups/postgres`.
- next_inputs: Plan 1 (Phase G0) đã hoàn thành 100%. Chuyển giao sang Kế hoạch Phase G1 (Gate 2 — Outbox, AuditLog, Strict CI, Avalonia Mobile R9).

## Commit
- Hash: e4c5c08
- Đã push: true

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
