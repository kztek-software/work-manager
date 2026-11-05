# STEP-2.1: Nâng Cấp API /api/my-work Trả Về Việc Chưa Phân Công & Danh Sách Thành Viên

## Mục tiêu
- Khi người dùng là `ADMIN` (hoặc có quyền quản trị/phân công việc):
  - Truy vấn bổ sung các công việc có `assigneeId: null` trong các dự án người dùng có quyền truy cập.
  - Trả về trường `unassignedTasks`, `unassignedCount`, và danh sách `assignableMembers` trong phản hồi JSON của `/api/my-work`.
