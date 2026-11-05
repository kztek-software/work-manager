---
step: 1.1
plan: ../PLAN-MASTER.md
agent: senior-developer
status: done
completed_at: 2026-11-02 17:06
deps: []
---

# STEP 1.1 — Tinh gọn nhãn Task Card & Viền thẻ

## Input nhận
Từ PLAN-MASTER: Vấn đề "quá nhiều màu sắc" trên thẻ task. Hiện tại mỗi thẻ có vạch màu trái dày, nhãn labels mỗi cái một màu nền/viền pastel, avatar có màu rực rỡ khiến thẻ task bị rối mắt và xung đột màu với priority.

## Nhiệm vụ
- Chỉnh sửa `src/components/board/task-card.tsx`:
  - Nhãn `task.labels`: Đưa toàn bộ về phong cách trung tính: `bg-surface-2 text-muted border border-line text-[10px] font-medium`, ngoại trừ nếu là tag `bug` thì giữ điểm nhấn đỏ nhạt (`bg-rose-500/10 text-rose-500 border-rose-500/25`).
  - Viền trái thẻ (Priority strip): Thu gọn độ dày thanh chỉ thị xuống 2.5px bo góc mềm mại, opacity 80% để chỉ giữ làm điểm nhận diện nhỏ gọn, không lấn át thẻ.
  - Sửa lỗi co cụm và cắt chữ tiêu đề task type: tách `#number` thành `shrink-0 font-mono font-bold text-muted` để số task không bao giờ bị cắt ngắn thành `#17 · Công ...`.

## Definition of Done
- [x] Tag `frontend`, `backend`, `ai`, `infra` hiển thị màu trung tính thanh lịch.
- [x] Badge độ ưu tiên (P0-P3) và tag `bug` giữ được màu nhận diện nổi bật.
- [x] Thẻ task nhìn sạch sẽ, phân cấp thị giác rõ ràng.

## Đã làm
- Cập nhật `src/components/board/task-card.tsx`:
  - Đưa styling của nhãn labels thành tone Slate/Gray: `bg-surface-2 text-muted border-line/80 hover:bg-surface-3`. Riêng nhãn chứa từ khóa `bug` hoặc `lỗi` dùng màu cảnh báo `bg-rose-500/10 text-rose-500 border-rose-500/25`.
  - Thay đổi thanh viền ưu tiên bên trái: giảm từ 3px gắt xuống 2.5px với `opacity-80`.
  - Tách phần hiển thị mã task và nhãn loại công việc để bảo toàn số task `#number`.

## Artifact
- `src/components/board/task-card.tsx`

## Quyết định quan trọng
- Không dùng màu ngẫu nhiên/pastel rực rỡ cho tag công việc thông thường; chuyển màu nổi bật thành "đặc quyền" cho mức độ khẩn cấp (Priority) và Bug.

## Handoff Payload — bước sau đọc phần này (chỉ phần này, không cần đọc "Đã làm")
- do_not_redo: Đã tinh gọn tag task card và viền priority bên trái.
- watch_out: Kiểm tra class Tailwind `bg-surface-2` và `border-line` ở chế độ Light Mode.
- next_inputs: `src/components/board/task-card.tsx` đã cập nhật.

## Commit
- Hash: đang chờ commit cùng Step 1.2
- Đã push: không

---
**Status icons:** ⬜ Todo | 🔄 In Progress | ✅ Done | 🛑 Blocked | ⏭️ Skipped
