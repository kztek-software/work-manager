---
step: 2.1
plan: ../PLAN-MASTER.md
agent: cto
status: done
completed_at: 2026-11-02T17:01:00+07:00
deps: [1.1]
---

# STEP 2.1 — Thẩm định Chiến lược, Phê duyệt Lộ trình & Ban hành ADR

## Input nhận
- Báo cáo phân tích kỹ thuật chuyên sâu từ `tech-lead` (`docs/architecture/ARCH-AUDIT-system-2026-11-02.md`) cùng `Handoff Payload` của `STEP-1.1`.

## Nhiệm vụ
Đóng vai trò CTO (L1) thẩm định độc lập (Two-Eyes Principle) toàn bộ báo cáo phân tích của Tech Lead dưới góc nhìn chiến lược công nghệ 1–3 năm, chi phí vận hành và mức độ sẵn sàng Golive/Scale (P1). Đưa ra quyết định chính thức (Phê duyệt / Điều kiện Golive), chốt ma trận ưu tiên đầu tư (Impact vs Effort) qua 3 giai đoạn (Phase 0 Pre-Golive Blockers → Phase 1 Short-term 1–3 tháng → Phase 2 Mid/Long-term 6–18 tháng) và ban hành `docs/architecture/ADR-001-system-architecture-roadmap.md`.

## Definition of Done
- [x] Thẩm định đầy đủ báo cáo của Tech Lead (xác nhận hoặc điều chỉnh mức độ ưu tiên rủi ro dưới góc nhìn Business + Tech).
- [x] Ban hành `docs/architecture/ADR-001-system-architecture-roadmap.md` theo đúng chuẩn `.gemini/templates/ADR-template.md` và `.gemini/agents/cto.md` (Trạng thái, Bối cảnh, Phương án xem xét Ưu/Nhược, Quyết định + Lý do, Điều kiện Golive, Hệ quả, Người thực thi, Deadline review, Ký duyệt CTO).
- [x] Chạy `python scripts/md_to_docx_kztek.py` cho ADR, file step này và `PLAN-MASTER.md` hoàn chỉnh (kiểm tra `.docx` / `.pdf` theo G005).
- [x] Cập nhật `STEP-2.1`, đổi status `PLAN-MASTER.md` sang `done`, và commit đúng các file thuộc bước 2.1.

## Đã làm
- Thực hiện thẩm định độc lập (Two-Eyes Review) ở cấp **CTO (L1 — Executive)** đối với toàn bộ báo cáo kiểm toán `ARCH-AUDIT-system-2026-11-02` dưới lăng kính Business ROI, Tổng chi phí sở hữu (TCO 1–3 năm) và Quản trị rủi ro an ninh doanh nghiệp.
- Phân tích, đối chiếu 3 phương án chiến lược (Phương án A: Vá nóng tối thiểu Golive ngay; Phương án B: **Modular Monolith Cứng Hóa Phân Tầng + Golive 2 Cấp + Mở Rộng Theo Ngưỡng KPI**; Phương án C: Tái kiến trúc Microservices toàn diện ngay từ đầu) và phê duyệt **Phương án B (Conditional Approval)**.
- Phản biện và tinh chỉnh thực dụng 5 điểm trọng yếu trên lộ trình của Tech Lead:
  1. **Tách cổng Golive 2 cấp (2-Tier Golive):** Mở **Tier-1 Internal LAN Pilot** ngay sau khi xong Phase G0 (~9 man-days) để sớm tạo giá trị kinh doanh; giữ **Tier-2 Public Internet (`/portal` + Webhooks)** sau Gate 2 (Phase G1).
  2. **Bổ sung `G1-0` — PostgreSQL Transactional Outbox (`FOR UPDATE SKIP LOCKED`, +2 man-days):** Giải quyết dứt điểm rủi ro mất thông báo khi container restart ngay ở Giai đoạn 1 với **0đ chi phí hạ tầng mới**, thay vì chờ tới Giai đoạn 2 mới dựng Redis.
  3. **Định hướng C# Avalonia Mobile rõ ràng:** Tạm đóng băng bản Mobile cũ ở G0 (dùng Mobile Web/PWA tạm thời), không vá chắp vá trên control mặc định `Avalonia 11.0.10`, dồn lực chuẩn hóa 100% lên `KztekComponentAvalonia` (`12.1.0`) + `.Android`/`.iOS` tại `G1-3` theo đúng Rule R9.
  4. **Thiết lập Ngưỡng KPI Định Lượng (KPI Gates) cho Giai đoạn 2:** Chống over-engineering — chỉ giải ngân Redis (`>= 2` nodes hoặc `> 200` concurrent SSE users), MinIO/S3 (`uploads-data > 50 GB`), FTS (`> 100.000` bản ghi hoặc P95 `> 200ms`) khi số liệu thực tế chạm ngưỡng.
  5. **Ràng buộc kỹ thuật Next.js 16:** Lưu ý sử dụng `src/proxy.ts` kết hợp `withApiAuth()` HOF khi triển khai `G0-1`.
- Ban hành tài liệu chính thức `docs/architecture/ADR-001-system-architecture-roadmap.md` kèm sơ đồ Mermaid lộ trình Go/No-Go, Ma trận Ưu tiên Đầu tư (Q1–Q4, ngân sách G0=9d / G1=24d / G2=30d KPI-gated) và Checklist nghiệm thu Gate 1 & Gate 2.
- Xuất đầy đủ bộ định dạng chuẩn thương hiệu KZTEK (`.docx` + `.pdf`) cho `ADR-001`, `STEP-2.1` và `PLAN-MASTER.md` theo Rule R1.

## Artifact
- `docs/architecture/ADR-001-system-architecture-roadmap.md`
- `docs/architecture/ADR-001-system-architecture-roadmap.docx`
- `docs/architecture/ADR-001-system-architecture-roadmap.pdf`
- `docs/plans/PLAN-system-audit-and-roadmap-2026-11-02/steps/STEP-2.1-cto-strategic-review-adr.md` (+ `.docx`, `.pdf`)
- `docs/plans/PLAN-system-audit-and-roadmap-2026-11-02/PLAN-MASTER.md` (+ `.docx`, `.pdf`)

## Quyết định quan trọng
- **Quyết định CTO:** **CÓ — Phê duyệt có điều kiện (Conditional Approval — Phương án B)**; giữ nguyên hiệu lực **`🛑 BLOCK GOLIVE`** hiện thời cho tới khi vượt qua `10/10` tiêu chí tại **Gate 1 (Phase G0 — 9.0 man-days, hạn review 2026-11-16)**.
- **Ngân sách & Lộ trình sau tinh chỉnh:** Phase G0 = **9.0 man-days** (mở Tier-1 LAN) → Phase G1 = **24.0 man-days** (bổ sung PostgreSQL Outbox `G1-0`, mở Tier-2 Internet & phát hành Mobile chuẩn `KztekComponentAvalonia`, hạn review **2026-12-28**) → Phase G2 = **30.0 man-days** (chỉ giải ngân từng mô-đun khi chạm KPI định lượng, review định kỳ **2027-03-31**).

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Hoàn tất toàn bộ workflow `WF-ARCH` (`ARCH-AUDIT-system-2026-11-02` + `ADR-001-system-architecture-roadmap` đã được CTO ký duyệt kèm đầy đủ `.docx`/`.pdf`). Không cần khảo sát hay thẩm định lại kiến trúc hiện trạng khi mở các task thực thi G0/G1.
- watch_out: (1) Hệ thống đang ở trạng thái `🛑 BLOCK GOLIVE` — tuyệt đối không mở port/domain ra Internet trước khi vượt qua Gate 1 & Gate 2 trong `ADR-001`; (2) Khi bắt đầu sửa code ở `G0-1`, phải tuân thủ chuẩn Next.js 16 (`src/proxy.ts` + `withApiAuth()` HOF) và cập nhật lại `code-graph/CODE-GRAPH.md` theo Rule R3 (hiện đang ghi nhầm `SQL Server`); (3) Không phát hành bản cài `mobile/` cũ cho tới khi hoàn thành `G1-3` chuẩn `KztekComponentAvalonia` (Rule R9).
- next_inputs: Sử dụng trực tiếp bảng phân bổ `G0-1` → `G0-6` và Checklist Gate 1 trong `docs/architecture/ADR-001-system-architecture-roadmap.md` làm đầu vào khởi tạo Plan thực thi Phase G0 (`WF-HOTFIX` / `WF-BUGFIX` / `WF-DEVOPS`) dưới sự điều phối của `Engineering Manager` và `Tech Lead`.

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
