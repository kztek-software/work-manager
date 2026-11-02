---
step: 1.2
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-02 17:06
deps: [1.1]
---

# STEP 1.2 — Chuẩn hóa thanh công cụ Filter

## Input nhận
Nhận từ PLAN-MASTER và Step 1.1: Thanh filter toolbar trong `src/app/board/board-view.tsx` hiện đang dùng các icon emoji sặc sỡ trong tiêu đề dropdown (`🚀 Tất cả Sprint`, `👤 Tất cả nhân sự`, `📋 Trạng thái`, `🔥 Ưu tiên`, `⏰ Thời gian`, `🏷️ Loại task`), tạo cảm giác lộn xộn màu sắc.

## Nhiệm vụ
- Cập nhật `src/app/board/board-view.tsx`:
  - Loại bỏ các emoji sặc sỡ trên cả giao diện Desktop và Mobile Modal sheet (`🚀`, `👤`, `📋`, `🔥`, `⏰`, `🏷️`), đưa về nhãn text gọn gàng chuẩn Enterprise: "Tất cả Sprint", "Tất cả nhân sự", "Trạng thái", "Ưu tiên", "Thời hạn", "Loại task".
  - Chuẩn hóa dot trạng thái cột trong `src/components/board/board-column.tsx`: Bỏ hiệu ứng đèn neon `boxShadow: 0 0 8px ${status.color}80`, đưa về dot tinh tế và thanh lịch.

## Definition of Done
- [x] Không còn emoji sặc sỡ trên các dropdown bộ lọc chính.
- [x] Giao diện thanh toolbar đồng bộ phong cách tối giản (Monochrome / Modern Enterprise).
- [x] Bộ lọc hoạt động bình thường, không làm gãy logic filter hiện hữu.

## Đã làm
- Cập nhật `src/app/board/board-view.tsx` loại bỏ emoji khỏi tất cả options của filter dropdown.
- Cập nhật `src/components/board/board-column.tsx` bỏ neon glow box-shadow trên dot trạng thái cột.

## Artifact
- `src/app/board/board-view.tsx`
- `src/components/board/board-column.tsx`

## Quyết định quan trọng
- Đồng bộ nhãn bộ lọc thành text chuẩn tiếng Việt thanh lịch, không dùng icon emoji lòe loẹt.

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Đã chỉnh sửa dropdown filter labels và column dots.
- watch_out: Không
- next_inputs: `src/app/board/board-view.tsx`, `src/components/board/board-column.tsx`

## Commit
- Hash: đang chờ commit
- Đã push: không

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
