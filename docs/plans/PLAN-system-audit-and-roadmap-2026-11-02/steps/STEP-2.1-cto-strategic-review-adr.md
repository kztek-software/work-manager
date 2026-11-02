---
step: 2.1
plan: ../PLAN-MASTER.md
agent: cto
status: todo
completed_at:
deps: [1.1]
---

# STEP 2.1 — Thẩm định Chiến lược, Phê duyệt Lộ trình & Ban hành ADR

## Input nhận
- Báo cáo phân tích kỹ thuật chuyên sâu từ `tech-lead` (`docs/architecture/ARCH-AUDIT-system-2026-11-02.md`) cùng `Handoff Payload` của `STEP-1.1`.

## Nhiệm vụ
Đóng vai trò CTO (L1) thẩm định độc lập (Two-Eyes Principle) toàn bộ báo cáo phân tích của Tech Lead dưới góc nhìn chiến lược công nghệ 1–3 năm, chi phí vận hành và mức độ sẵn sàng Golive/Scale (P1). Đưa ra quyết định chính thức (Phê duyệt / Điều kiện Golive), chốt ma trận ưu tiên đầu tư (Impact vs Effort) qua 3 giai đoạn (Phase 0 Pre-Golive Blockers → Phase 1 Short-term 1–3 tháng → Phase 2 Mid/Long-term 6–18 tháng) và ban hành `docs/architecture/ADR-001-system-architecture-roadmap.md`.

## Definition of Done
- [ ] Thẩm định đầy đủ báo cáo của Tech Lead (xác nhận hoặc điều chỉnh mức độ ưu tiên rủi ro dưới góc nhìn Business + Tech).
- [ ] Ban hành `docs/architecture/ADR-001-system-architecture-roadmap.md` theo đúng chuẩn `.gemini/templates/ADR-template.md` và `.gemini/agents/cto.md` (Trạng thái, Bối cảnh, Phương án xem xét Ưu/Nhược, Quyết định + Lý do, Điều kiện Golive, Hệ quả, Người thực thi, Deadline review, Ký duyệt CTO).
- [ ] Chạy `python scripts/md_to_docx_kztek.py` cho ADR, file step này và `PLAN-MASTER.md` hoàn chỉnh (kiểm tra `.docx` / `.pdf` theo G005).
- [ ] Cập nhật `STEP-2.1`, đổi status `PLAN-MASTER.md` sang `done`, và commit đúng các file thuộc bước 2.1.

## Đã làm


## Artifact


## Quyết định quan trọng


## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo:
- watch_out:
- next_inputs:

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
