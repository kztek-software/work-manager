---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 08:41:00deps: [1.1]
---

# STEP 1.2 — Xây Dựng API Quản Lý Nhãn & Chuẩn Hóa Badge Nhãn Nổi Bật

## Input nhận
- Câu hỏi người dùng: *"Phần nhãn này quản lý ở đâu, làm sao để thêm sửa xóa + sửa để các badge nhãn cùng kích thước"*
- Ảnh chụp người dùng: *"phần nhãn đang được chọn k nổi bật"*

## Nhiệm vụ
1. **API Labels**:
   - `src/app/api/projects/[projectId]/labels/route.ts` (GET, POST).
   - `src/app/api/projects/[projectId]/labels/[labelId]/route.ts` (PATCH, DELETE).
2. **Component LabelManagerDialog**:
   - `src/components/board/label-manager-dialog.tsx`: Giao diện thêm nhãn mới (nhập tên, chọn màu), sửa tên/màu, xóa nhãn.
3. **Đồng bộ kích thước & Làm nổi bật nhãn được chọn**:
   - Trong `NewTaskDialog` và `TaskDialog`:
     - Badge chưa chọn: nền xám nhạt trung tính `bg-surface-2`, có chấm tròn màu nhận diện `w-2 h-2`.
     - Badge ĐANG CHỌN: nền màu đậm của nhãn, có icon checkmark sắc nét, viền ring sáng rõ ràng, chữ tương phản cao (trắng hoặc đen tùy màu nền).
     - Chiều cao cố định chuẩn: `h-6.5 px-2.5 text-[11px]`.
     - Thêm nút `[⚙️ Quản lý nhãn]` mở dialog quản lý.
