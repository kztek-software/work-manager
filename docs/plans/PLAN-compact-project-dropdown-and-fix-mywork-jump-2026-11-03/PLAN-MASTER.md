---
task: compact-project-dropdown-and-fix-mywork-jump
created: 2026-11-03
updated: 2026-11-03
status: completed
workflow: WF-BUGFIX
priority: P1
branch: feature/refactor-kanban-color-palette
---

# PLAN MASTER: Sửa Lỗi Nhảy Dự Án Khi Xem My Work & Tinh Gọn Dropdown Dự Án

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước (mô tả đầy đủ, Handoff Log, artifact chi tiết) nằm ở `steps/STEP-[N.M]-[tên].md` tương ứng — xem cột "Step file" bên dưới.

## Mô tả
Giải quyết 2 vấn đề lớn được người dùng phát hiện:
1. **Lỗi nhảy dự án khi xem My Work**:
   - Khắc phục việc `src/app/my-work/page.tsx` code cứng `contextProjectId = projects[0].id`.
   - Lưu trữ và đồng bộ dự án đang hoạt động qua Cookie `flowboard_active_project` và Query param.
   - Thêm nút shortcut `Mở dự án ↗` trong giao diện My Work.
2. **Tinh gọn Dropdown Danh sách Dự án (Sidebar)**:
   - Xóa bỏ badge trạng thái 96px lặp lại ở mỗi dòng dự án (đã có header nhóm).
   - Đổi `[✓ Đang chọn]` thành icon tích xanh `✓` nhỏ gọn căn phải.
   - Cho tên dự án hiển thị dài trọn vẹn, không bị cắt cụt `...` sớm.
   - Nâng chiều cao dropdown lên `max-h-[380px]`, tránh thanh cuộn sớm khi mới có 4–5 dự án.

## Nguồn yêu cầu
- Yêu cầu gốc: "ok xử lý và tôi vừa thấy thêm lỗi phần my work bị lỗi bấm vào xem là bị nhảy dự án"
- Workflow: `WF-BUGFIX` — Khắc phục lỗi điều hướng & Tinh gọn UI
- Agent chain: `Senior Developer` (Phase 1, 2 thực thi) → `Tech Lead` (Phase 3 review & typecheck) → `UX/UI Reviewer` (Kiểm tra trực quan C1-C7 & sign-off)

## Phases & Steps

### Phase 1: Sửa Triệt Để Lỗi Nhảy Dự Án Tại My Work
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Lưu & Đồng bộ Active Project Context | `Senior Developer` | ✅ | `steps/STEP-1.1-active-project-cookie-and-mywork-context.md` | - |
| 1.2 | Bổ sung điều hướng nhanh trong My Work | `Senior Developer` | ✅ | `steps/STEP-1.2-mywork-open-project-shortcut.md` | - |

### Phase 2: Tinh Gọn Dropdown Dự Án Sidebar
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 2.1 | Tái cấu trúc Dropdown Sidebar (Clean Layout) | `Senior Developer` | ✅ | `steps/STEP-2.1-clean-compact-project-dropdown.md` | - |

### Phase 3: Review Kỹ Thuật & Kiểm Tra Trực Quan
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 3.1 | Typecheck & Build Verification | `Tech Lead` | ✅ | `steps/STEP-3.1-tech-lead-build-and-typecheck.md` | - |
| 3.2 | UX/UI Visual Evaluation & QA Sign-off | `UX/UI Reviewer` | ✅ | `steps/STEP-3.2-ux-ui-review-and-qa-signoff.md` | - |

## Artifacts dự kiến (tổng)
- [ ] `src/app/my-work/page.tsx`
- [ ] `src/app/board/page.tsx`
- [ ] `src/components/app-shell.tsx`
- [ ] `src/app/my-work/my-work-view.tsx`
- [ ] `docs/plans/PLAN-compact-project-dropdown-and-fix-mywork-jump-2026-11-03/PLAN-MASTER.md` & `steps/STEP-*.md` (+ `.docx`, `.pdf` theo Rule R1)

## Blockers
Không có

## Lịch sử cập nhật
| Ngày | Cập nhật | Agent |
|------|----------|-------|
| 2026-11-03 | Khởi tạo plan sau khi user duyệt "ok" | task-planner |

---
**Status icons:** ✅ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
