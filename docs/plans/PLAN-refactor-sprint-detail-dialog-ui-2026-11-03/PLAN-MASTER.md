---
task: refactor-sprint-detail-dialog-ui
created: 2026-11-03
updated: 2026-11-03
status: completed
workflow: WF-REFACTOR
priority: P1
branch: feature/phase-g0-security-and-golive-blockers
---

# PLAN MASTER: Tái Cấu Trúc Giao Diện Sprint Detail Dialog (Chi Tiết Sprint)

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước nằm ở `steps/STEP-[N.M]-[tên].md`.

## Mô tả vấn đề từ người dùng
Người dùng gửi ảnh chụp màn hình modal Chi tiết Sprint (`SprintDetailDialog`) với phản hồi: *"phần này cũng khá tệ"*. Qua phân tích chi tiết trực quan và mã nguồn `src/components/sprint/sprint-detail-dialog.tsx`:
1. **Lỗi lặp Badge trạng thái ở Header**:
   - Khi Sprint có trạng thái `COMPLETED`, giao diện hiển thị cùng lúc 2 badge: `(✓) Đã hoàn thành` và `(⏳) Đã hoàn thành` (do `timeInfo.statusLabel` gán đè chuỗi trạng thái thay vì hiển thị thời lượng/tiến độ thời gian).
2. **Cột Tiêu đề công việc bị bóp nghẹt, cắt cụt `...` nghiêm trọng**:
   - Tiêu đề là thông tin quan trọng nhất nhưng chỉ hiển thị được ~15–18 ký tự (`Thuật toán lọc nhi...`, `Xây dựng công cụ...`, `Hiện thực SerialPo...`), khiến người dùng không đọc được nội dung công việc nếu không rê chuột hoặc bấm vào từng dòng.
   - Nguyên nhân: Các cột cố định xung quanh (`Mã task`, `Nhãn`, `Points`, `Hạn chót`, `Phụ trách`, `Trạng thái dropdown`) chiếm hơn 680px trên tổng chiều rộng của bảng.
3. **Cột Nhãn (Labels) bị cắt vụn vô nghĩa (`comp:...`, `tech:...`)**:
   - `max-w-[60px]` bóp nghẹt nhãn nghiệp vụ (ví dụ `component:backend` thành `comp:...`), vừa chiếm chỗ vừa không có giá trị thông tin.
4. **Cột Trạng thái dùng Dropdown form cồng kềnh**:
   - Mỗi dòng render một PrimeReact Dropdown full widget 130px gây rối mắt và lãng phí không gian. Nên chuyển thành Status Badge pill tinh gọn, click để đổi trạng thái.
5. **Bố cục chiếm quá nhiều diện tích dọc khiến người dùng phải cuộn chuột**:
   - Mục tiêu Sprint, dải phân bổ nhân sự, thanh công cụ tìm kiếm và nút hành động dàn trải thành nhiều tầng, đẩy bảng công việc xuống sâu dù chỉ có 5 tasks.

## Mục tiêu giải pháp
- **Header**: Sửa dứt điểm duplicate badge. Hiển thị 1 badge trạng thái duy nhất + thời gian thực tế rõ ràng.
- **Bảng công việc**:
  - Tối ưu tỷ trọng cột: Cột Tiêu đề công việc được cấp không gian rộng rãi (tối thiểu 40–50% chiều ngang), không bị cắt cụt cụt chữ sớm.
  - Nhãn hiển thị thanh thoát, không cắt vụn kiểu `comp:...`.
  - Trạng thái hiển thị dưới dạng Status Pill thanh lịch (đúng màu chuẩn design system), nhỏ gọn, dễ nhìn.
  - Độ tương phản của task hoàn thành: Không gạch chữ quá đậm làm khó đọc, giữ tính dễ đọc.
- **Mật độ thông tin (Density)**: Tinh gọn dải Goal, Member summary và Toolbar để toàn bộ modal vừa vặn, xem trọn vẹn 5–10 tasks mà không cần cuộn trang.

## Agent Chain Bắt Buộc
- **Senior Developer**: Tái cấu trúc component `src/components/sprint/sprint-detail-dialog.tsx`.
- **Tech Lead**: Review kỹ thuật, kiểm tra typecheck (`tsc --noEmit`) và responsive layout.
- **UX/UI Reviewer**: Chạy app thật, kiểm tra trực quan theo 7 tiêu chí C1–C7, đối chiếu trước và sau.

## Phases & Steps

### Phase 1: Tái Cấu Trúc SprintDetailDialog
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Sửa Header, loại bỏ Duplicate Badge & Tinh gọn Goal/Workload | `Senior Developer` | ✅ | `steps/STEP-1.1-compact-header-and-summary.md` | - |
| 1.2 | Thiết kế lại Task Table: mở rộng Tiêu đề, Clean Status & Labels | `Senior Developer` | ✅ | `steps/STEP-1.2-refactor-task-table.md` | - |

### Phase 2: Review & Verification
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 2.1 | Typecheck & Build Verification | `Tech Lead` | ✅ | `steps/STEP-2.1-tech-lead-verification.md` | - |
| 2.2 | Visual Evaluation & UX/UI Reviewer Sign-off | `UX/UI Reviewer` | ✅ | `steps/STEP-2.2-ux-ui-review-signoff.md` | - |

## Artifacts dự kiến
- `src/components/sprint/sprint-detail-dialog.tsx`
- `docs/plans/PLAN-refactor-sprint-detail-dialog-ui-2026-11-03/`

---
**Status icons:** ✅ Todo | ✅ In Progress | ✅ Done | 🛑 Blocked
