---
step: 3.2
plan: ../PLAN-MASTER.md
agent: devops-lead
status: todo
completed_at:
deps: [3.1]
---

# STEP 3.2 — Cứng hóa Docker, Diễn tập Backup/Restore & Sign-off Gate 1

## Input nhận
- Báo cáo kiểm thử PASS 100% từ QA Engineer tại `STEP-3.1`.

## Nhiệm vụ
1. Cập nhật `docker-compose.yml`:
   - Bind cổng PostgreSQL `127.0.0.1:5432:5432` thay vì phơi mở toàn bộ interface `0.0.0.0`.
   - Cấu hình `healthcheck` cho service `app` sử dụng endpoint `/api/health`.
   - Khởi tạo và cấp quyền cho volume dữ liệu `/app/data`.
2. Xây dựng bộ script sao lưu CSDL PostgreSQL định kỳ `scripts/backup-postgres.sh` và `scripts/backup-postgres.ps1` (lưu file `.ps1` có UTF-8 BOM theo G002).
3. Thực hiện diễn tập sao lưu `pg_dump` thực tế và chạy kiểm thử khôi phục (restore drill) trên một database test, xác nhận tính toàn vẹn 100% của dữ liệu sao lưu.
4. Xác nhận tình trạng đóng băng bộ cài C# Mobile cũ theo chỉ đạo của ADR-001 (Tiêu chí #9).
5. Tổng hợp biên bản và ký quyết định mở Cổng Golive Tier-1 (Mạng LAN Nội bộ KZTEK / VPN): `docs/architecture/GATE1-SIGNOFF-2026-11-02.md`.

## Definition of Done
- [ ] `docker-compose.yml` được cấu hình bảo mật đúng chuẩn.
- [ ] Script sao lưu tự động hoạt động mượt mà; diễn tập khôi phục DB thành công 100%.
- [ ] Hoàn tất `docs/architecture/GATE1-SIGNOFF-2026-11-02.md` (+ `.docx`, `.pdf` theo Rule R1).
- [ ] Gate 1 được nghiệm thu và mở thành công.

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
