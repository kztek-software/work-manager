---
step: 2.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 07:15:00deps: [1.2]
---

# STEP 2.1 — Tái cấu trúc Dropdown Sidebar (Clean Layout)

## Input nhận
Nhận từ ảnh chụp UI và phân tích: Dropdown danh sách dự án trong `src/components/app-shell.tsx` bị chật chội, tên dự án bị cắt cụt do badge lặp lại và chiều cao cố định thấp.

## Nhiệm vụ
- Cập nhật Dropdown Project Selector trong `src/components/app-shell.tsx`:
  - Xóa bỏ badge trạng thái to 96px (`pStatusMeta`) ở bên phải mỗi item (vì đã có tiêu đề nhóm `🟢 ĐANG THỰC HIỆN` gom nhóm rõ ràng).
  - Đổi badge `[✓ Đang chọn]` thành icon tích xanh `<Check className="h-4 w-4 text-accent stroke-[2.5]" />` nhỏ gọn căn phải.
  - Cho tên dự án tận dụng 100% bề ngang, hiển thị chữ rõ nét không bị cắt cụt (`line-clamp-2` hoặc truncate khi quá 2 dòng).
  - Tăng chiều cao danh sách từ `max-h-64` (256px) lên `max-h-[380px]` để hiển thị thoải mái 8–10 dự án mà không bị thanh cuộn ép sớm.

## Definition of Done
- [ ] Không còn badge trạng thái lặp lại ở từng dòng.
- [ ] Tên dự án dài (`Hệ thống Hướng dẫn Báo chỗ đỗ xe - iPGS...`, `Keangnam Landmark`) hiển thị trọn vẹn, không bị cắt sớm.
- [ ] Dấu tích xanh dự án đang chọn hiển thị tinh tế ở lề phải.

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
