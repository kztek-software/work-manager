---
task: ui-ux-enhancements-and-mywork
created: 2026-11-02
updated: 2026-11-02
status: completed
workflow: WF-FEATURE
priority: P1
branch: feature/ui-ux-enhancements-and-mywork
---

# PLAN MASTER: Hoàn thiện UI/UX, Sửa lỗi Điều hướng & Bổ sung Tính năng MyWork

> File này CHỈ chứa tổng quan + trạng thái. Chi tiết từng bước nằm ở steps/STEP-[N.M]-[tên].md tương ứng.

## 1. Mô tả yêu cầu & Mục tiêu
Giải quyết toàn diện các phản hồi người dùng sau khi chạy thử hệ thống:
1. **Thiếu tính năng MyWork**: Bổ sung trang toàn cục `/my-work` tổng hợp tất cả công việc của user từ các dự án, hỗ trợ nhóm theo dự án và lọc theo trạng thái/thời hạn.
2. **Lỗi bấm Board bị nhảy dự án**: Loại bỏ fallback nhầm về dự án đầu tiên trong `layout.tsx`, sửa cơ chế Pinned Nav lưu relative path thay vì lưu absolute ID cũ.
3. **Sidebar Splitter & Nhóm dự án**: Thêm thanh kéo giãn Splitter cho Sidebar trái (240px - 380px, lưu localStorage); phân nhóm dự án (Đang thực hiện, Lên kế hoạch, Hoàn thành).
4. **Sắp xếp lại Dropdown Dự án**: Chuyển sang bố cục 2 cột gọn gàng: Cột 1 Tên + Key bên trái, Cột 2 Badge trạng thái căn phải cùng kích thước.
5. **Thêm trường Người liên hệ cho Task**: Bổ sung `contactName` và `contactPhone` vào model Task, cập nhật Dialog tạo/sửa task.
6. **Tự động bắt định dạng danh sách 1. 2. 3.**: Cập nhật `WysiwygEditor` tự động kích hoạt `insertOrderedList` khi gõ `1. ` (Space/Enter) và nhảy số tiếp theo.
7. **Trải nghiệm Subtask**: Thêm phản hồi trực quan (Toast thông báo "Đã lưu việc con") khi thêm subtask và làm rõ trạng thái lưu.
8. **Chuẩn hóa Ô Tìm kiếm (SearchInput)**: Tạo component dùng chung `SearchInput` đồng bộ kích thước thoải mái, khắc phục triệt để lỗi icon kính lúp đè lên chữ và chữ bị đẩy lệch trái.
9. **Cố định Kích thước Cột Trạng thái & Người liên hệ**: Cố định độ rộng cột Người liên hệ (`145px`) và cột Trạng thái (`105px`) trên MyWork để tất cả các dòng thẳng hàng tuyệt đối như bảng biểu.
10. **Thu gọn/Mở rộng Menu Sidebar & Thẻ Dự Án**: Cho phép đóng mở từng nhóm điều hướng và từng nhóm dự án trên MyWork kèm ghi nhớ trạng thái vào `localStorage`.
11. **Bấm ra ngoài để đóng Dialog (Dismissable Mask)**: Cấu hình `dismissableMask={true}` và `closeOnEscape={true}` cho 100% Dialog trong toàn bộ hệ thống.
12. **Lazy Loading Tránh Treo UI**: Thay thế màn hình xoay tròn loading bằng Progressive Skeleton rendering và bộ nhớ RAM SWR Cache (`useTabCache`) tải 0ms tức thì.
13. **Sửa lỗi đè lớp Z-Index Popup Đổi trạng thái**: Khắc phục hiện tượng nút `Board Công Việc` đè lên popup đổi trạng thái dự án trên Sidebar.

## 2. Phases & Steps

### Phase 1: Sửa Lỗi Điều Hướng & Trải Nghiệm Giao Diện Hiện Hữu
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 1.1 | Sửa lỗi nhảy dự án & Tái cấu trúc Dropdown Dự án thành 2 cột ngay ngắn | Senior Developer | ✅ | steps/STEP-1.1-fix-navigation-and-project-selector.md | 2026-11-02 11:50 |
| 1.2 | Thêm Toast phản hồi lưu Subtask & Tự động bắt danh sách 1. 2. 3. trong Editor | Junior Developer | ✅ | steps/STEP-1.2-fix-subtask-feedback-and-editor-auto-numbering.md | 2026-11-02 11:51 |

### Phase 2: Mở Rộng Tính Năng & Kiến Trúc Dữ Liệu
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 2.1 | Thêm Splitter kéo giãn độ rộng Sidebar & Phân nhóm dự án | Senior Developer | ✅ | steps/STEP-2.1-sidebar-splitter-and-project-grouping.md | 2026-11-02 11:50 |
| 2.2 | Bổ sung trường Người liên hệ (contactName, contactPhone) cho Task | Senior Developer | ✅ | steps/STEP-2.2-task-contact-person-field.md | 2026-11-02 11:59 |
| 2.3 | Xây dựng API và Trang toàn cục MyWork (/my-work) gom việc đa dự án | Senior Developer | ✅ | steps/STEP-2.3-global-mywork-feature.md | 2026-11-02 12:01 |

### Phase 3: Tinh Chỉnh Chi Tiết UI/UX & Fix Triệt Để Theo Feedback
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 3.1 | Chuẩn hóa Component SearchInput (khắc phục icon đè chữ & chữ lệch trái) | Senior Developer | ✅ | steps/STEP-3.1-standardize-search-input.md | 2026-11-02 14:04 |
| 3.2 | Cố định kích thước Cột Trạng thái & Cột Người liên hệ trên MyWork | Senior Developer | ✅ | steps/STEP-3.2-fixed-column-widths-mywork.md | 2026-11-02 14:05 |
| 3.3 | Bổ sung tính năng Thu gọn Menu Sidebar & Đổi nhanh Trạng thái Dự án | Senior Developer | ✅ | steps/STEP-3.3-sidebar-collapsible-and-quick-status.md | 2026-11-02 14:05 |
| 3.4 | Thu gọn/mở rộng nhóm dự án MyWork & Lazy loading SWR + Progressive Skeleton | Senior Developer | ✅ | steps/STEP-3.4-mywork-collapsible-and-swr-skeleton.md | 2026-11-02 14:22 |
| 3.5 | Cấu hình dismissableMask toàn bộ Dialog & Fix lỗi Z-index popup trạng thái | Senior Developer | ✅ | steps/STEP-3.5-dialog-dismissable-and-zindex-fix.md | 2026-11-02 14:23 |
| 3.6 | Fix render HTML mô tả chi tiết, Active format highlight trong WYSIWYG & Nâng chiều cao Tap/Click target | Senior Developer | ✅ | steps/STEP-3.6-wysiwyg-active-states-and-tap-targets.md | 2026-11-02 16:45 |

### Phase 4: Review, Verification & Tạo Pull Request
| # | Bước | Agent | Status | Step file | Hoàn thành lúc |
|---|------|-------|--------|-----------|-----------------|
| 4.1 | Verification checklist, Type check & UX Review | Tech Lead & QA | ✅ | steps/STEP-4.1-verify-and-code-graph.md | 2026-11-02 14:25 |
| 4.2 | Merge nhánh feature/ui-ux-enhancements-and-mywork về staging | DevOps Engineer | ✅ | — | 2026-11-02 14:45 |

## 3. Danh sách Artifacts
- [x] docs/plans/PLAN-ui-ux-enhancements-and-mywork-2026-11-02/PLAN-MASTER.md
- [x] docs/plans/PLAN-ui-ux-enhancements-and-mywork-2026-11-02/PLAN-MASTER.docx
- [x] src/components/ui/search-input.tsx
- [x] src/app/my-work/my-work-view.tsx
- [x] src/components/app-shell.tsx
- [x] src/components/board/board-project-picker.tsx
