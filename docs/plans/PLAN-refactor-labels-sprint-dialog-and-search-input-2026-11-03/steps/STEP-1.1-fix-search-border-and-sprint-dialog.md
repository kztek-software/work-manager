---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-03 08:41:00deps: []
---

# STEP 1.1 — Sửa Viền Kép SearchInput & Xóa Gạch Chữ / Cắt Cụt Bảng Sprint

## Input nhận
- Ảnh chụp từ người dùng về viền xanh chồng viền cam trên `SearchInput`.
- Ảnh chụp bảng Sprint có chữ gạch ngang `line-through` khó nhìn và tiêu đề bị `...`.

## Nhiệm vụ
1. **SearchInput (`src/components/ui/search-input.tsx`)**:
   - Thêm `outline: none !important` triệt tiêu viền xanh focus-visible của Chromium.
   - Bỏ `focus:ring-2 focus:ring-accent/20`, chỉ dùng một đường viền `focus:border-accent` tinh tế.
2. **SprintDetailDialog (`src/components/sprint/sprint-detail-dialog.tsx`)**:
   - Xóa bỏ `line-through` trên tên công việc đã hoàn thành.
   - Cho phép tiêu đề task xuống 2 dòng tự nhiên với `display: -webkit-box; -webkit-line-clamp: 2`.
   - Mở rộng cột Tiêu đề công việc lên tối đa.
