---
task: ultra-compact-project-dropdown-and-fix-kanban-card
created: 2026-11-03
updated: 2026-11-03
status: completed
workflow: WF-REFACTOR
priority: P1
branch: feature/phase-g0-security-and-golive-blockers
---

# PLAN MASTER: Siêu Tinh Gọn Dropdown Dự Án (Single-Line + Accordion) & Xóa Bỏ Cắt Cụt Chữ Trên Thẻ Kanban

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước nằm ở `steps/STEP-[N.M]-[tên].md`.

## Mô tả vấn đề từ người dùng
Người dùng phản hồi hai vấn đề lớn về mật độ thông tin và độ hoàn thiện UI:
1. **Dropdown danh sách dự án quá dài khi mở rộng nhiều dự án & khách hàng**:
   - Hiện tại mỗi dòng dự án chiếm tới ~54px (2 tầng: Tên + Mã key). Với 10-20 dự án sẽ tràn màn hình và phải cuộn nhiều.
   - Các nhóm trạng thái `ĐANG THỰC HIỆN`, `LÊN KẾ HOẠCH` đang là text tĩnh, không bấm thu gọn được.
   - **Giải pháp**:
     - Chuyển thành hàng ngang đơn (Single-Line Compact Row): `[Mini Avatar 20px] [Tên dự án] [Mã KEY] [✓]` (chiều cao giảm 45% xuống ~32px/dòng).
     - Cho phép click Header nhóm để đóng/mở (Collapsible Accordion Group với icon ChevronDown).
2. **Thẻ Kanban bị cắt cụt chữ loại công việc (`#16 • Công vi...`, `#17 • Cô...`, `#18 • Tín...`)**:
   - Trên đầu mỗi thẻ Kanban, việc nhồi nhét cả Icon Loại việc, Mã task, Tên loại việc (`· Công việc`, `· Tính năng`), Điểm Story Points, và Badge Độ ưu tiên (`= Trung bình`) vào chiều ngang chỉ ~250px khiến Tên loại việc bị cắt cụt chữ rất xấu (`Cô...`, `Công vi...`, `Tính ...`).
   - **Giải pháp**:
     - `TypeIcon` đã là biểu tượng đại diện loại việc (kèm title tooltip). Bỏ chuỗi text thừa `· {type.label}` để hàng đầu thẻ Kanban thoáng đãng: `[TypeIcon] #{task.number}` bên trái, điểm points + độ ưu tiên bên phải.
     - Triệt tiêu 100% hiện tượng xén cụt chữ trên toàn bộ thẻ Kanban.

## Agent Chain Bắt Buộc
- **Senior Developer**: Thực hiện tái cấu trúc `src/components/app-shell.tsx` và `src/components/board/task-card.tsx`.
- **Tech Lead**: Kiểm tra typecheck `tsc --noEmit` và bảo toàn chức năng kéo thả/điều hướng.
- **UX/UI Reviewer**: Chạy app thật, nghiệm thu trực quan 7 tiêu chí C1–C7.

## Phases & Steps
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Single-Line Compact Row & Collapsible Groups trong Sidebar Dropdown | `Senior Developer` | ✅ | `steps/STEP-1.1-compact-single-line-dropdown-and-accordion.md` | - |
| 1.2 | Xóa bỏ cắt cụt chữ trên đầu thẻ Kanban | `Senior Developer` | ✅ | `steps/STEP-1.2-fix-kanban-card-type-and-header.md` | - |
| 2.1 | Review Kỹ Thuật, Typecheck & Verification | `Tech Lead` | ✅ | `steps/STEP-2.1-tech-lead-verification.md` | - |
| 2.2 | Đánh giá trực quan C1–C7 & Sign-off | `UX/UI Reviewer` | ✅ | `steps/STEP-2.2-ux-ui-review-signoff.md` | - |

## Artifacts dự kiến
- `src/components/app-shell.tsx`
- `src/components/board/task-card.tsx`
- `docs/plans/PLAN-ultra-compact-project-dropdown-and-fix-kanban-card-2026-11-03/`

---
**Status icons:** ✅ Todo | ✅ In Progress | ✅ Done | 🛑 Blocked
