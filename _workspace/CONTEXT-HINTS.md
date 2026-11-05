# CONTEXT-HINTS: compact-project-dropdown-and-fix-mywork-jump (WF-BUGFIX | P1)
## 1. Modules chính cần thay đổi
- **MyWork Context & Layout**: `src/app/my-work/page.tsx` (nhận `searchParams.projectId`, đọc cookie `flowboard_active_project`)
- **App Shell Navigation & Dropdown**: `src/components/app-shell.tsx` (lưu cookie `flowboard_active_project` khi đổi dự án, tinh gọn dropdown: bỏ badge lặp lại, hiển thị tên đầy đủ, `max-h-[380px]`)
- **MyWork View**: `src/app/my-work/my-work-view.tsx` (nút shortcut `Mở dự án ↗` tại mỗi header nhóm dự án)
- **Board Page Context**: `src/app/board/page.tsx` (đọc cookie `flowboard_active_project` khi không có `projects` query)
## 2. Skills & Gotchas khuyến nghị
- Tra `GOTCHAS.md` G013: Node/npm path `$env:PATH = "C:\Users\Admin\node\PFiles64\nodejs;$env:PATH"`.
- Cookie `flowboard_active_project`: Đặt `Path=/`, `Max-Age=2592000` (30 ngày), `SameSite=Lax`.
## 3. Điểm UNCERTAIN & Lưu ý
- Đảm bảo khi một người dùng là Admin hoặc Member, cookie được validate tồn tại trong danh sách dự án mà user có quyền truy cập, tránh ID rác.
