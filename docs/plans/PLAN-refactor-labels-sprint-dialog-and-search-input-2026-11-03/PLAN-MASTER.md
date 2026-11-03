---
task: refactor-labels-sprint-dialog-and-search-input
created: 2026-11-03
updated: 2026-11-03
status: completed
workflow: WF-REFACTOR
priority: P1
branch: feature/phase-g0-security-and-golive-blockers
---

# PLAN MASTER: Quản Lý Nhãn Dự Án, Đồng Bộ Style Search & Tối Ưu Bảng Sprint

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước nằm ở `steps/STEP-[N.M]-[tên].md`.

## Mô tả 4 vấn đề từ người dùng
1. **Search Input bị nhiều lớp border chồng nhau**:
   - Vùng tìm kiếm dự án bị viền xanh dương (outline focus-visible mặc định của trình duyệt) chồng lên viền cam của hệ thống.
   - **Giải pháp**: Xóa bỏ hoàn toàn browser outline bằng `outline: none !important`, tắt `ring-2` gây viền kép, chỉ giữ 1 border accent duy nhất sắc nét.
2. **Bảng Sprint Detail Dialog bị "khó nhìn + bị ..."**:
   - Tên công việc hoàn thành bị gạch ngang (`line-through`) làm mờ chữ tiếng Việt có dấu.
   - Tên công việc bị cắt cụt đuôi `...` trên cả 7 dòng.
   - **Giải pháp**: Bỏ gạch ngang `line-through` (giữ chữ rõ nét `text-foreground/85`), cho phép tên task xuống dòng tự nhiên (`line-clamp-2`), nới rộng độ rộng cột Tiêu đề công việc.
3. **Badge Nhãn chưa đồng bộ kích thước & Nhãn đang chọn không nổi bật**:
   - Nhãn chưa chọn và nhãn đang chọn có kích thước nhảy thụt thò khi thêm icon check, màu sắc nhãn chọn chưa đủ nổi bật, độ tương phản kém (đặc biệt màu vàng/sáng).
   - **Giải pháp**: Chuẩn hóa chiều cao `h-6.5`, padding `px-2.5`, nhãn chưa chọn nền trung tính có chấm màu; nhãn đang chọn rực rỡ với màu thương hiệu, icon tích trắng/đen tương phản cao, viền ring sáng rõ rệt.
4. **Tính năng Quản lý Nhãn (Thêm / Sửa / Xóa)**:
   - Người dùng hỏi: *"Phần nhãn này quản lý ở đâu, làm sao để thêm sửa xóa?"*
   - **Giải pháp**: Xây dựng API `/api/projects/[projectId]/labels` và Modal `LabelManagerDialog` tích hợp trực tiếp ngay cạnh dòng `Nhãn phân loại` trong NewTaskDialog và TaskDialog, cho phép thêm mới, chỉnh sửa tên/màu và xóa nhãn tức thì.

## Agent Chain Bắt Buộc
- **Senior Developer**: Viết API Labels, Component LabelManagerDialog, tinh chỉnh SearchInput và SprintDetailDialog.
- **Tech Lead**: Kiểm tra typecheck `tsc --noEmit` và bảo toàn chức năng.
- **UX/UI Reviewer**: Đánh giá trực quan 7 tiêu chí C1–C7, nghiệm thu tính nổi bật của nhãn và độ sắc nét.

## Phases & Steps
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Sửa viền kép SearchInput & Xóa gạch chữ/cắt cụt bảng Sprint | `Senior Developer` | ✅ | `steps/STEP-1.1-fix-search-border-and-sprint-dialog.md` | - |
| 1.2 | Xây dựng API Quản lý Nhãn & Chuẩn hóa Badge Nhãn Nổi Bật | `Senior Developer` | ✅ | `steps/STEP-1.2-build-label-manager-and-badges.md` | - |
| 2.1 | Review Kỹ Thuật & Typecheck Compile | `Tech Lead` | ✅ | `steps/STEP-2.1-tech-lead-verification.md` | - |
| 2.2 | Nghiệm thu trực quan C1–C7 & Sign-off | `UX/UI Reviewer` | ✅ | `steps/STEP-2.2-ux-ui-review-signoff.md` | - |

## Artifacts dự kiến
- `src/components/ui/search-input.tsx`
- `src/components/sprint/sprint-detail-dialog.tsx`
- `src/components/board/new-task-dialog.tsx`
- `src/components/board/task-dialog.tsx`
- `src/app/api/projects/[projectId]/labels/route.ts`
- `src/app/api/projects/[projectId]/labels/[labelId]/route.ts`
- `src/components/board/label-manager-dialog.tsx`
- `docs/plans/PLAN-refactor-labels-sprint-dialog-and-search-input-2026-11-03/`

---
**Status icons:** ✅ Todo | ✅ In Progress | ✅ Done | 🛑 Blocked
