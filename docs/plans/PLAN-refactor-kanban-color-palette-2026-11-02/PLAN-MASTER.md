---
task: refactor-kanban-color-palette
created: 2026-11-02
updated: 2026-11-02
status: completed
workflow: WF-REFACTOR
priority: P2
branch: feature/refactor-kanban-color-palette
---

# PLAN MASTER: Tinh gọn Bảng màu Kanban Board & Chuẩn hóa Hệ thống Nhãn/Bộ lọc theo Clean Design System

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước (mô tả đầy đủ, Handoff Log, artifact chi tiết) nằm ở `steps/STEP-[N.M]-[tên].md` tương ứng — xem cột "Step file" bên dưới.

## Mô tả
Khắc phục triệt để hiện tượng "hiệu ứng cầu vồng" (Rainbow Effect / Color Clutter) trên giao diện Kanban Board (`FlowBoard Core`), nơi có quá nhiều màu sắc sặc sỡ đan xen (màu cột, màu viền trái thẻ, màu tag chuyên môn, màu emoji bộ lọc, màu priority, màu avatar...). 
Đã hoàn thành chuẩn hóa theo Design System tinh giản (chuẩn Linear/Jira):
1. **Tags chuyên môn (`frontend`, `backend`, `ai`, `design`, `infra`...)**: Đưa về màu trung tính (Neutral Slate/Gray: `bg-surface-2`, `text-muted`, `border-line`), loại bỏ hoàn toàn các màu nền pastel sặc sỡ gây nhiễu. Riêng tag `bug`/lỗi giữ màu nhấn cảnh báo.
2. **Thanh Filter Toolbar**: Bỏ emoji sặc sỡ trong dropdown options (`🚀`, `👤`, `📋`, `🔥`, `⏰`, `🏷️`), đưa về nhãn văn bản đồng nhất và chuyên nghiệp.
3. **Quy tắc phân cấp màu**: Giữ màu sắc độc quyền cho **Độ ưu tiên (Priority)** và **Cảnh báo lỗi (Bug/Issue)**.
4. **Khắc phục Text Truncation**: Tách số hiệu task `#number` thành khối riêng `shrink-0`, ngăn chặn việc bị cắt cụt `#17 · Công ...`.

## Nguồn yêu cầu
- Yêu cầu gốc: "tôi thì thấy quá nhiều màu sắc" -> Đề xuất giải pháp và user duyệt "ok"
- Workflow: `WF-REFACTOR` — Tinh chỉnh UI / Chuẩn hóa Design System
- Agent chain: `Senior Developer` (Phase 1 thực thi CSS/UI) → `Tech Lead` (Phase 2 review & typecheck) → `UX/UI Reviewer` (Kiểm tra trực quan C1-C7) → `QA Engineer` (Kiểm thử regression)

## Phases & Steps

### Phase 1: Tinh gọn Bảng màu Task Card & Filter Toolbar
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Tinh gọn nhãn Task Card & Viền thẻ | `Senior Developer` | ✅ | `steps/STEP-1.1-neutralize-task-card-tags.md` | 2026-11-02 17:06 |
| 1.2 | Chuẩn hóa thanh công cụ Filter | `Senior Developer` | ✅ | `steps/STEP-1.2-monochrome-filter-toolbar.md` | 2026-11-02 17:06 |

### Phase 2: Review Kỹ thuật & Kiểm tra Trực quan UX/UI
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 2.1 | Code Review & Typecheck | `Tech Lead` | ✅ | `steps/STEP-2.1-tech-lead-review-and-typecheck.md` | 2026-11-02 17:08 |
| 2.2 | UX/UI Visual Evaluation | `UX/UI Reviewer` | ✅ | `steps/STEP-2.2-ux-ui-review-visual-verification.md` | 2026-11-02 17:09 |
| 2.3 | QA Regression & Sign-off | `QA Engineer` | ✅ | `steps/STEP-2.3-qa-regression-and-signoff.md` | 2026-11-02 17:10 |

## Artifacts dự kiến (tổng)
- [x] `src/components/board/task-card.tsx`
- [x] `src/app/board/board-view.tsx`
- [x] `src/components/board/board-column.tsx`
- [x] `docs/plans/PLAN-refactor-kanban-color-palette-2026-11-02/PLAN-MASTER.md` & `steps/STEP-*.md` (+ `.docx`, `.pdf` theo Rule R1)

## Blockers
Không có

## Quyết định / Ghi chú tổng
- Tag chuyên môn hiển thị phong cách Slate Neutral tối giản, tăng tối đa khả năng tập trung vào công việc chính.
- Màu nhấn chỉ dành cho việc cần chú ý khẩn cấp.

## Lịch sử cập nhật
| Ngày | Cập nhật | Agent |
|------|----------|-------|
| 2026-11-02 | Khởi tạo plan sau khi user duyệt "ok" | task-planner |
| 2026-11-02 | Hoàn thành toàn bộ Phase 1 và Phase 2, sign-off release | tech-lead |

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
