# STEP-2.2: Bổ Sung Tab Việc Chưa Phân Công & Chức Năng Phân Công Nhanh Vào MyWorkView

## Mục tiêu
- Thêm bộ chọn chế độ (Segmented Tabs) trên đỉnh trang `/my-work`:
  - `[👤 Việc của tôi (N)]`
  - `[📋 Chưa phân công (M)]` (với badge màu cam nổi bật nếu M > 0)
- Khi ở chế độ "Chưa phân công":
  - Hiển thị danh sách các task chưa có người phụ trách.
  - Mỗi dòng có nút / dropdown "Phân công ngay" (Quick Assign) cho phép gán việc cho nhân sự trực tiếp bằng 1 click.
  - Cập nhật tức thì trên giao diện (Optimistic UI) và thông báo Toast xác nhận thành công.
