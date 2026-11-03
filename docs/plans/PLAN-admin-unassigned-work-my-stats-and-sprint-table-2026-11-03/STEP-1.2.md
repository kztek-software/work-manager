# STEP-1.2: Nâng Cấp Thống Kê Công Việc (My Stats) Hỗ Trợ Quản Trị Viên

## Mục tiêu
- Cập nhật `/api/me/stats`:
  - Hỗ trợ `scope=all` khi người dùng là `ADMIN` (tổng hợp công việc của tất cả thành viên trong dự án).
  - Trả về danh sách `allMembers` khi là `ADMIN` để có thể lọc xem theo bất kỳ nhân sự nào (`memberId`).
- Cập nhật UI `/projects/[projectId]/my-stats`:
  - Bổ sung tùy chọn "Toàn bộ nhân sự (Toàn hệ thống)" trong bộ chọn phạm vi.
  - Hiển thị banner hướng dẫn khi Admin ở chế độ cá nhân nhưng chưa có task nào được giao trực tiếp.
- Cập nhật liên kết phòng ban/team cho các user demo trong CSDL để bộ lọc nhóm hoạt động đúng.
