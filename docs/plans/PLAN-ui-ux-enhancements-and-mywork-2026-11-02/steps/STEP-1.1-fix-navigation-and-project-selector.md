---
step: 1.1
title: Sửa lỗi nhảy dự án & Tái cấu trúc Dropdown Dự án thành 2 cột ngay ngắn
agent: senior-developer
status: in_progress
completed_at: null
---

# STEP 1.1: Sửa lỗi nhảy dự án & Tái cấu trúc Dropdown Dự án thành 2 cột ngay ngắn

## Nhiệm vụ
1. **Khắc phục lỗi nhảy dự án khi click vào Board (Mục 2)**:
   - Sửa logic trong `src/app/projects/[projectId]/layout.tsx`: Không fallback ngầm về dự án đầu tiên khi `projectId` không tìm thấy mà cần báo lỗi / điều hướng hợp lý; đảm bảo `projectId` tra cứu cả theo `id` và `key`.
   - Sửa logic Pinned Nav trong `src/components/app-shell.tsx`: Pinned items phải lưu theo đuôi đường dẫn (ví dụ `/board`, `/reports`, `/tickets`, `/dashboard`) hoặc ánh xạ theo dự án hiện tại thay vì lưu cứng ID của dự án cũ.
2. **Sắp xếp lại Dropdown Danh sách Dự án (Mục 4)**:
   - Tái cấu trúc danh sách trong `src/components/app-shell.tsx`:
     - Cột 1 (Bên trái): Avatar viết tắt + Tên dự án (in đậm) + Mã Key (nhạt).
     - Cột 2 (Bên phải): Badge trạng thái cố định độ rộng (`min-w-[90px]`, căn giữa text, căn phải) thẳng hàng đồng đều.
