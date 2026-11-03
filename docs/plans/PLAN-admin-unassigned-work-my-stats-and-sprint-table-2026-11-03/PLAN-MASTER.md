# PLAN-MASTER: Bổ sung Quản lý Việc Chưa Phân Công (Admin), Thống Kê Toàn Bộ Nhân Sự & Hoàn Thiện Bảng Sprint Detail

## 1. Mục tiêu & Bối cảnh
- **Bối cảnh**:
  1. Người dùng yêu cầu bảng công việc trong Sprint Detail Dialog đẩy cột Trạng thái sang sát lề phải, cột Tiêu đề chiếm toàn bộ chiều rộng còn lại (tránh chữ bị cắt xén `...` hoặc để lại khoảng trắng vô ích bên phải bảng).
  2. Người dùng kiểm tra tab "Thống kê công việc" thấy hiển thị toàn bộ số 0 và hỏi tính năng có hoạt động không. Nguyên nhân: tài khoản đang đăng nhập là Quản trị viên KZTEK (ADMIN) chưa được giao task trực tiếp nào; các task thuộc về Bình Trần, Chi Lê, Alice Nguyễn hoặc chưa giao. Đồng thời hệ thống thiếu chế độ xem "Toàn bộ nhân sự" cho Quản trị viên.
  3. Người dùng yêu cầu: "Với admin cần bổ sung phần việc chưa được phân công, để phân công" trên màn hình Việc của tôi (`/my-work`).
- **Mục tiêu**:
  - [Sprint Dialog]: Đẩy cột Trạng thái sang sát phải, mở rộng cột Tiêu đề chiếm trọn chiều rộng (`1fr` trên `w-full min-w-[850px]`).
  - [Thống kê công việc]: Hỗ trợ chế độ "Toàn bộ nhân sự (Toàn hệ thống)" và xem theo từng thành viên cho Quản trị viên; liên kết thành viên vào Phòng ban/Team trong CSDL; có banner hướng dẫn trực quan khi Admin xem cá nhân 0 task.
  - [Việc của tôi - Admin]: Thêm tab/chế độ "Việc chưa phân công" kèm chức năng Phân công nhanh (Quick Assign) ngay trên dòng công việc.

## 2. Các bước triển khai
- **Bước 1.1**: Tối ưu layout bảng công việc trong `SprintDetailDialog`: `w-full min-w-[850px]`, `grid-cols-[85px_1fr_95px_50px_75px_110px_110px_32px]`, cột Trạng thái sát phải, cột Tiêu đề chiếm trọn width.
- **Bước 1.2**: Nâng cấp API `/api/me/stats` và trang `/projects/[projectId]/my-stats` hỗ trợ Admin xem Toàn bộ nhân sự (`scope=all`), lọc theo từng thành viên, gán user vào Team trong DB.
- **Bước 2.1**: Nâng cấp API `/api/my-work` trả về `unassignedTasks` và danh sách thành viên dự án cho Admin.
- **Bước 2.2**: Bổ sung tab "Việc chưa phân công" và dropdown "Phân công nhanh" trong `MyWorkView` (`/my-work`).
- **Bước 3.1**: Kiểm tra TypeScript (`tsc --noEmit`), dev server smoke test và xuất tài liệu DOCX/PDF theo quy chuẩn R1.
