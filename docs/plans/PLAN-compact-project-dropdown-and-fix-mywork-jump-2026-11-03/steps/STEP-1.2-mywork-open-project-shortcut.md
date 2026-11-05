---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 07:15:00deps: [1.1]
---

# STEP 1.2 — Bổ sung điều hướng nhanh trong My Work

## Input nhận
Nhận từ PLAN-MASTER: Trong `src/app/my-work/my-work-view.tsx`, người dùng thấy các nhóm công việc theo dự án nhưng không có cách nào nhảy trực tiếp vào Board của dự án đó ngoài việc bấm dropdown sidebar.

## Nhiệm vụ
- Cập nhật `src/app/my-work/my-work-view.tsx`:
  - Tại mỗi thanh tiêu đề nhóm dự án (Project Header Bar), thêm nút shortcut `Mở dự án ↗` (hoặc icon `ExternalLink`) dẫn thẳng tới `/board?projects=${project.id}` hoặc `/projects/${project.id}/dashboard`.
  - Nút này bấm sẽ mở đúng dự án và cập nhật cookie context mà không làm co/giãn accordion (`e.stopPropagation()`).

## Definition of Done
- [ ] Có nút mở dự án trực quan tại từng nhóm dự án trong My Work.
- [ ] Bấm mở dự án sẽ chuyển thẳng đến đúng Board của dự án đó.

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
