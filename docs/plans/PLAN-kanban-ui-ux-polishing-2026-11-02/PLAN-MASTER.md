---
task: kanban-ui-ux-polishing
created: 2026-11-02
updated: 2026-11-02
status: completed
workflow: WF-FASTTRACK
priority: P3
branch: feature/refactor-kanban-color-palette
---

# PLAN MASTER: Tinh chỉnh Chi tiết Vi mô UI/UX Kanban Board (Khoảng cách Cột, Padding Thẻ & Avatar)

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước (mô tả đầy đủ, Handoff Log, artifact chi tiết) nằm ở `steps/STEP-[N.M]-[tên].md` tương ứng — xem cột "Step file" bên dưới.

## Mô tả
Tiếp tục hoàn thiện các chi tiết vi mô (Micro-interactions & Polish) trên giao diện Kanban Board (`FlowBoard Core`):
1. **Khoảng cách & Bố cục Cột (`board-column.tsx` & `board-view.tsx`)**:
   - Mở rộng không gian thở cho Header cột (`px-2 py-1.5`).
   - Cân chỉnh độ rộng tối thiểu của cột (`min-w-[245px]` trên Desktop) để các cột dàn đều thoáng đãng.
   - Khoảng cách giữa các cột mở rộng lên `gap-3 sm:gap-3.5 md:gap-4`.
2. **Padding & Cân đối Thẻ Task (`task-card.tsx`)**:
   - Tối ưu padding trong thẻ (`p-3`), khoảng cách dòng giữa Title, Tags và Footer để các thẻ có nhịp điệu thị giác (Visual Rhythm) đồng đều.
   - Tách nhẹ đường phân cách Footer (`border-t border-line/50 pt-2`), căn chỉnh icon bình luận, checklist và ngày tháng thẳng hàng.
3. **Avatar Nhân sự Tinh tế (`task-card.tsx`, `assignee-quick-select.tsx`)**:
   - Nâng cấp viền avatar: bo tròn viền kép tinh xảo (`ring-1 ring-black/5 dark:ring-white/10 border border-background shadow-xs`).
   - Tối ưu kích thước (`23px`) vừa vặn trong footer.

## Nguồn yêu cầu
- Yêu cầu gốc: "Tiếp tục tối ưu thêm các chi tiết UX khác trên Board (khoảng cách cột, padding thẻ, avatar)" -> User duyệt "ok"
- Workflow: `WF-FASTTRACK` — Tinh chỉnh UI nhỏ
- Agent chain: `Senior Developer` (Phase 1 thực thi CSS/UI) → `Tech Lead` (Phase 2 review & typecheck) → `UX/UI Reviewer` (Kiểm tra trực quan C1-C7 & sign-off)

## Phases & Steps

### Phase 1: Tinh chỉnh Chi tiết Spacing, Padding & Avatar
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Tối ưu Khoảng cách Cột & Scrollbar | `Senior Developer` | ✅ | `steps/STEP-1.1-column-spacing-and-scrollbar.md` | 2026-11-02 20:41 |
| 1.2 | Chuẩn hóa Padding Thẻ & Avatar Styling | `Senior Developer` | ✅ | `steps/STEP-1.2-card-padding-and-avatar-styling.md` | 2026-11-02 20:41 |

### Phase 2: Review & Đánh giá Trực quan UX/UI
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 2.1 | Typecheck & Build Verification | `Tech Lead` | ✅ | `steps/STEP-2.1-tech-lead-build-and-typecheck.md` | 2026-11-02 20:42 |
| 2.2 | Visual Inspection & QA Sign-off | `UX/UI Reviewer` | ✅ | `steps/STEP-2.2-ux-ui-review-and-qa-signoff.md` | 2026-11-02 20:43 |

## Artifacts dự kiến (tổng)
- [x] `src/components/board/board-column.tsx`
- [x] `src/app/board/board-view.tsx`
- [x] `src/components/board/task-card.tsx`
- [x] `src/components/board/assignee-quick-select.tsx`
- [x] `docs/plans/PLAN-kanban-ui-ux-polishing-2026-11-02/PLAN-MASTER.md` & `steps/STEP-*.md` (+ `.docx`, `.pdf` theo Rule R1)

## Blockers
Không có

## Lịch sử cập nhật
| Ngày | Cập nhật | Agent |
|------|----------|-------|
| 2026-11-02 | Khởi tạo plan sau khi user duyệt "ok" | task-planner |
| 2026-11-02 | Hoàn thành Phase 1 & Phase 2, sign-off release | tech-lead |

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
