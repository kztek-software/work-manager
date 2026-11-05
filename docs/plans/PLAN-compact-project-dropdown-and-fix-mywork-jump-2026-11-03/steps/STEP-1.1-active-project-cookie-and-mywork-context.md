---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 07:15:00deps: []
---

# STEP 1.1 — Lưu & Đồng bộ Active Project Context

## Input nhận
Từ PLAN-MASTER: Hiện tại `src/app/my-work/page.tsx` và `src/app/board/page.tsx` fallback cứng về `projects[0].id` thay vì ghi nhớ dự án người dùng đang làm việc.

## Nhiệm vụ
- Trong `src/components/app-shell.tsx`:
  - Mỗi khi `project.id` thay đổi hoặc người dùng chọn một dự án, ghi cookie `flowboard_active_project = project.id` với `path=/; max-age=2592000; SameSite=Lax`.
  - Cập nhật link "Việc Của Tôi": `{ href: `/my-work?projectId=${project.id}`, label: "Việc Của Tôi" }` để truyền tường minh context.
- Trong `src/app/my-work/page.tsx`:
  - Nhận `searchParams: Promise<{ projectId?: string }>`.
  - Đọc `searchParams.projectId` hoặc Cookie `flowboard_active_project`.
  - Nếu ID hợp lệ và nằm trong danh sách dự án của user, sử dụng ID đó làm `contextProjectId` thay vì `projects[0].id`.
- Trong `src/app/board/page.tsx`:
  - Tương tự, nếu không có param `projects` trên URL, ưu tiên kiểm tra Cookie `flowboard_active_project` trước khi fallback về `projects[0].id`.

## Definition of Done
- [ ] Bấm vào "Việc Của Tôi" từ bất kỳ dự án nào, dự án trên Sidebar vẫn giữ nguyên, không bị nhảy về dự án đầu tiên.
- [ ] Cookie `flowboard_active_project` được cập nhật liên tục và an toàn.

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
