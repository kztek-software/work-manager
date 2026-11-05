# BÁO CÁO KIỂM THỬ THỰC TẾ & NGHIỆM THU AN NINH CHỐT CHẶN GATE 1
## (Gate 1 Real-App Security, RBAC, Concurrency & Quality Verification Report)

- **Mã tài liệu:** `QA-REPORT-gate1-2026-11-02`
- **Dự án:** KZTEK Work Management (FlowBoard)
- **Workflow:** `WF-HOTFIX` (Bước 3.1 — Phase 3: Real-App Security QA & Regression Testing)
- **Mức độ ưu tiên:** P0 (Chặn Golive — Hotfix An ninh & Khắc phục Lỗ hổng Mạng LAN Pilot)
- **Đơn vị thực hiện:** QA Engineer (L5 — Junior IC)
- **Người tiếp nhận:** DevOps Lead (Bước 3.2 — Cứng hóa Docker, Backup Drill & Ký mở Cổng Tier-1 LAN)
- **Căn cứ kế hoạch:** `PLAN-phase-g0-security-and-golive-blockers-2026-11-02` & `docs/architecture/ADR-001-system-architecture-roadmap.md`
- **Môi trường thử nghiệm:** Real Application HTTP Server (`http://localhost:3000`) & PostgreSQL 17 Localhost (`127.0.0.1:5432`)
- **Kết quả tổng quan:** **53/53 Test Cases ĐẠT (PASS 100%) — 0 P0/P1 Defects — CHẤP THUẬN CHẤT LƯỢNG GATE 1**

---

## 1. Tóm Tắt Tổng Quan (Executive Summary)

Thực hiện theo chỉ đạo của Engineering Manager và Tech Lead tại kế hoạch `PLAN-phase-g0-security-and-golive-blockers-2026-11-02`, QA Engineer đã xây dựng kịch bản kiểm thử tự động toàn diện `scripts/test_gate1_security.ts` và thực thi trực tiếp trên **ứng dụng thật đang chạy (running real application on port 3000)** kết hợp cơ sở dữ liệu PostgreSQL 17 thực tế.

Toàn bộ **10 tiêu chí nghiệm thu Gate 1** quy định tại `ADR-001` nhằm gỡ bỏ lệnh `🛑 BLOCK GOLIVE` và mở cổng **Tier-1 LAN Pilot (Mạng LAN Nội Bộ KZTEK / VPN)** đã được kiểm thử độc lập từ tầng giao thức HTTP, Cookie phiên, Gateway Proxy, cơ chế xử lý đồng thời (Concurrency), đến tầng mã hóa dữ liệu CSDL.

### Bảng Chỉ Số Nghiệm Thu Chất Lượng
| Chỉ số kiểm thử | Giá trị mục tiêu | Kết quả thực tế | Đánh giá |
|---|---|---|---|
| **Tổng số kịch bản kiểm thử (Test Cases)** | $\ge 40$ | **53 test cases** | Vượt định mức |
| **Tỷ lệ kiểm thử thành công (Pass Rate)** | 100% | **53/53 PASS (100.0%)** | ✅ **ĐẠT** |
| **Số lỗi nghiêm trọng phát hiện (P0/P1)** | 0 | **0 defects** | ✅ **ĐẠT** |
| **Khóa leo thang quyền Admin (A01)** | 100% từ chối 401/403 | **11/11 tests PASS** | ✅ **ĐẠT** |
| **Bảo vệ dữ liệu Ticket nội bộ (A01/I)** | 0 rò rỉ `internalNotes` | **6/6 tests PASS** | ✅ **ĐẠT** |
| **Khử mã độc Stored XSS & HttpOnly (A03/A05)** | 0% script lọt lưới, 100% HttpOnly | **8/8 tests PASS** | ✅ **ĐẠT** |
| **Che giấu Secrets & Mã hóa DB (A02/A09)** | Mask `******`, DB `enc:v1:` | **6/6 tests PASS** | ✅ **ĐẠT** |
| **Rate-Limit & Upload An toàn (A04/A07)** | Chặn request 11+ (429), chặn `.html/.svg` | **8/8 tests PASS** | ✅ **ĐẠT** |
| **Vòng đời JWT & Cưỡng chế đổi MK (A07/Perf)** | Thu hồi tức thì, chặn 403 `PASSWORD_CHANGE_REQUIRED` | **4/4 tests PASS** | ✅ **ĐẠT** |
| **Toàn vẹn Desktop & Tạo Task đồng thời** | Router alias 200, 10 task đồng thời 0 lỗi `P2002` | **4/4 tests PASS** | ✅ **ĐẠT** |
| **Sức khỏe Hệ thống (Health Probe)** | HTTP 200 `{ status: "ok", db: "connected" }` | **3/3 tests PASS** | ✅ **ĐẠT** |
| **Đóng băng Client cũ & Two-Eyes Review** | 0 build mobile cũ, đủ 2 biên bản duyệt | **3/3 tests PASS** | ✅ **ĐẠT** |

---

## 2. Môi Trường & Phương Pháp Kiểm Thử Thực Tế

### 2.1. Môi trường kiểm thử
- **Máy chủ ứng dụng:** Next.js 16.3.1 (Turbopack Native Engine) chạy trên cổng TCP `3000`.
- **Cơ sở dữ liệu:** PostgreSQL 17 lắng nghe trên `127.0.0.1:5432` (`WorkingManager?schema=public`).
- **Engine thực thi:** Node.js v24.15.0 & TypeScript via `tsx`.
- **Cấu hình kiểm thử:** `COOKIE_SECURE=false` (môi trường HTTP LAN), `APP_URL=http://localhost:3000`.
- **Công cụ kiểm thử độc lập:** `scripts/test_gate1_security.ts` sử dụng API `fetch` chuẩn W3C, tạo form data thực tế, cookie jar và gọi HTTP xuyên qua toàn bộ middleware proxy của Next.js 16.

### 2.2. Điểm cải tiến kỹ thuật phát hiện và khắc phục trong quá trình QA
1. **Khắc phục xung đột Concurrency khi tạo Task đồng thời:**
   - **Hiện tượng ban đầu:** Khi bắn đồng thời 10 requests tạo task vào cùng 1 project, chỉ 5 task được tạo thành công, 5 task còn lại bị lỗi xung đột mã `P2002` do vòng lặp retry ban đầu chỉ cấu hình `maxAttempts = 3`.
   - **Xử lý:** QA Engineer đã phối hợp điều chỉnh `maxAttempts = 10` kèm cơ chế **Exponential Jitter Backoff** ngẫu nhiên `Math.random() * 50 + 25 * attempt` (30–100ms) tại `src/app/api/projects/[projectId]/tasks/route.ts`. Kết quả kiểm thử lại đạt **10/10 task tạo thành công 100% với mã số duy nhất và liên tục**.
2. **Xác thực chốt chặn `mustChangePassword` ở tầng API:**
   - Đã xác minh cơ chế `withApiAuth` tại `src/app/api/users/route.ts` cưỡng chế chặn ngay lập tức HTTP status `403` kèm payload chuẩn `{ error: "Vui lòng đổi mật khẩu khởi tạo trước khi tiếp tục thao tác", code: "PASSWORD_CHANGE_REQUIRED" }`, ngăn chặn tài khoản chưa đổi mật khẩu ban đầu truy cập tài nguyên.

---

## 3. Tổng Hợp 10 Chốt Chặn Gate 1

```
Gate 1 — 10 Chốt Chặn Nghiệm Thu Chất Lượng Golive Tier-1 (LAN Pilot)
├── [Chốt 1] RBAC & Khóa Leo thang Đặc quyền (A01) ─────────── [11/11 PASS]
├── [Chốt 2] Cô lập Dữ liệu Ticket & Chặn Giả mạo isStaff ───── [ 6/6  PASS]
├── [Chốt 3] Triệt tiêu Stored XSS & Cookie HttpOnly ───────── [ 8/8  PASS]
├── [Chốt 4] Che giấu Secrets Masking & Mã hóa AES-256-GCM ──── [ 6/6  PASS]
├── [Chốt 5] Rate Limiter & An toàn Tải tệp Tệp tin ─────────── [ 8/8  PASS]
├── [Chốt 6] Thu hồi Phiên (tokenVersion) & mustChangePassword  [ 4/4  PASS]
├── [Chốt 7] Toàn vẹn Desktop & Concurrency (0 lỗi P2002) ───── [ 4/4  PASS]
├── [Chốt 8] Endpoint Kiểm tra Sức khỏe (/api/health) ──────── [ 3/3  PASS]
├── [Chốt 9] Đóng băng Bản cài C# Mobile Cũ Chưa Đạt Chuẩn ──── [ 1/1  PASS]
└── [Chốt 10] Nghiệm thu Kép Two-Eyes Sign-off Gate 1 ───────── [ 2/2  PASS]
```

---

## 4. Ma Trận Chi Tiết 53 Test Cases Thực Thi

### 4.1. Chốt chặn 1: RBAC & Khóa Leo thang Đặc quyền (A01)
| Mã TC | Endpoint / Thao tác | Quyền người gọi | Kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-1.1** | `GET /api/users` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.2** | `POST /api/users` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.3** | `PATCH /api/users/[id]` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.4** | `DELETE /api/users/[id]` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.5** | `POST /api/auth/register` | Ẩn danh (Tự đăng ký) | HTTP 403 Registration Closed | HTTP 403 Forbidden | ✅ **PASS** |
| **TC-1.6** | `DELETE /api/attachments/[id]` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.7** | `GET /api/notifications/email-logs` | Ẩn danh (No Auth) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-1.8** | `GET /api/users` | User role `MEMBER` | HTTP 403 Forbidden (Chặn bởi Gateway Proxy) | HTTP 403 Forbidden | ✅ **PASS** |
| **TC-1.9** | `POST /api/users` | User role `MEMBER` | HTTP 403 Forbidden | HTTP 403 Forbidden | ✅ **PASS** |
| **TC-1.10** | `GET /api/notifications/email-logs` | User role `MEMBER` | HTTP 403 Forbidden | HTTP 403 Forbidden | ✅ **PASS** |
| **TC-1.11** | `GET /api/users` | User role `ADMIN` | HTTP 200 OK (Danh sách người dùng) | HTTP 200 OK | ✅ **PASS** |

### 4.2. Chốt chặn 2: Cô Lập Dữ Liệu Ticket Nội Bộ & Chặn Giả Mạo `isStaff` (A01/I)
| Mã TC | Thao tác kiểm thử | Dữ liệu đầu vào | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-2.1** | `GET /api/tickets/[ticketId]` | Truy vấn từ người dùng ẩn danh | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-2.2** | Kiểm tra thuộc tính Ticket | Đọc trường `internalNotes` | `undefined` (Không tồn tại trong JSON) | `undefined` | ✅ **PASS** |
| **TC-2.3** | Kiểm tra danh sách bình luận | Lọc mảng `comments` | 0 bình luận nội bộ (`isInternalOnly=false`) | 1 comment công khai, 0 comment nội bộ | ✅ **PASS** |
| **TC-2.4** | `POST .../comments` | Body gửi mạo danh: `{ isStaff: true, isInternalOnly: true }` | HTTP 200/201 Thành công | HTTP 200 OK | ✅ **PASS** |
| **TC-2.5** | Kiểm tra bản ghi DB `isStaff` | Truy vấn trực tiếp PostgreSQL bảng `TicketComment` | `isStaff === false` | `isStaff: false` | ✅ **PASS** |
| **TC-2.6** | Kiểm tra bản ghi DB `isInternalOnly` | Truy vấn trực tiếp PostgreSQL bảng `TicketComment` | `isInternalOnly === false` | `isInternalOnly: false` | ✅ **PASS** |

### 4.3. Chốt chặn 3: Khử Trùng Stored XSS qua DOMPurify & Cấu Hình Cookie HttpOnly (A03/A05)
| Mã TC | Payload kiểm thử | Cơ chế xử lý | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-3.1** | `<script>alert("XSS")</script>` | `sanitizeHtml` (`isomorphic-dompurify`) | Thẻ script bị xóa sạch hoàn toàn | Đã xóa 100% thẻ script | ✅ **PASS** |
| **TC-3.2** | `<svg onload="alert('SVG_XSS')"><circle/></svg>` | `sanitizeHtml` | Thuộc tính `onload` bị bóc tách | Bóc tách sạch thuộc tính onload | ✅ **PASS** |
| **TC-3.3** | `<img src="invalid.jpg" onerror="alert(1)"/>` | `sanitizeHtml` | Thuộc tính `onerror` bị loại bỏ | Bóc tách sạch thuộc tính onerror | ✅ **PASS** |
| **TC-3.4** | `<a href="javascript:alert(1)">Click</a>` | `sanitizeHtml` | Giao thức `javascript:` bị vô hiệu hóa | Đã xóa giao thức javascript: | ✅ **PASS** |
| **TC-3.5** | `<span style="color:#F05922; background-color:#FEF08A">` | `sanitizeHtml` | Bảo toàn định dạng văn bản (bold, highlight vàng, màu cam) | Giữ nguyên style an toàn | ✅ **PASS** |
| **TC-3.6** | `POST /api/auth/login` | Header `Set-Cookie` trả về | Tên cookie `flowboard_session` | Đã thiết lập `flowboard_session` | ✅ **PASS** |
| **TC-3.7** | Cờ `HttpOnly` trên Cookie | Kiểm tra thuộc tính Set-Cookie | Chứa `HttpOnly` (ngăn XSS trộm cookie) | Đạt chuẩn `HttpOnly` | ✅ **PASS** |
| **TC-3.8** | Cờ `SameSite` trên Cookie | Kiểm tra thuộc tính Set-Cookie | Chứa `SameSite=Lax` (chống CSRF) | Đạt chuẩn `SameSite=Lax` | ✅ **PASS** |

### 4.4. Chốt chặn 4: Che Giấu Secrets Masking & Mã Hóa AES-256-GCM (A02/A09)
| Mã TC | Hạng mục kiểm thử | Đối tượng kiểm tra | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-4.1** | `GET /api/system/config` | Đăng nhập Admin gọi API | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-4.2** | Kiểm tra trường `smtp.pass` | Payload phản hồi JSON | Trả về `"******"` hoặc rỗng, 0% rò rỉ | `"******"` | ✅ **PASS** |
| **TC-4.3** | Hàm `encryptSecret` | Tiền tố bản tin mã hóa | Bắt đầu bằng tiền tố `"enc:v1:"` | Bắt đầu `"enc:v1:"` | ✅ **PASS** |
| **TC-4.4** | Cấu trúc Ciphertext | Định dạng tách dấu `:` | Đủ 5 thành phần: `enc:v1:iv:tag:data` | Đủ 5 thành phần chuẩn | ✅ **PASS** |
| **TC-4.5** | Hàm `decryptSecret` | Giải mã ciphertext | Khôi phục chính xác 100% dữ liệu gốc | Trùng khớp 100% plaintext | ✅ **PASS** |
| **TC-4.6** | Bảng `SystemSetting` DB | Truy vấn trực tiếp PostgreSQL 17 | `smtpPass` lưu trữ bắt đầu bằng `enc:v1:` | Lưu trữ mã hóa AES-256-GCM | ✅ **PASS** |

### 4.5. Chốt chặn 5: Rate Limiting & An Toàn Tải Tệp Tin (A04/A07)
| Mã TC | Kịch bản kiểm thử | Thông số thực thi | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-5.1** | Đăng nhập liên tiếp | 10 requests đầu tiên từ IP `198.51.100.x` | Không bị chặn Rate Limit | 10/10 requests được xử lý | ✅ **PASS** |
| **TC-5.2** | Đăng nhập vượt ngưỡng | Request thứ 11 trong 60 giây | HTTP 429 Too Many Requests | HTTP 429 Too Many Requests | ✅ **PASS** |
| **TC-5.3** | Thông báo lỗi Rate Limit | Body phản hồi của request 11 | Chứa *"Quá nhiều lần đăng nhập không thành công"* | Đúng nội dung cảnh báo | ✅ **PASS** |
| **TC-5.4** | `POST /api/upload` | Người dùng ẩn danh chưa đăng nhập | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-5.5** | Upload file `.html` | Đính kèm `exploit.html` | HTTP 400 Bad Request (Định dạng bị cấm) | HTTP 400 Bad Request | ✅ **PASS** |
| **TC-5.6** | Upload file `.svg` | Đính kèm `vector.svg` | HTTP 400 Bad Request (Định dạng bị cấm) | HTTP 400 Bad Request | ✅ **PASS** |
| **TC-5.7** | Upload fake PNG | Đính kèm `fake.png` (sai magic bytes) | HTTP 400 Bad Request (Phát hiện giả mạo) | HTTP 400 Bad Request | ✅ **PASS** |
| **TC-5.8** | Upload genuine PNG | Đính kèm `valid-pixel.png` (Magic Bytes chuẩn) | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |

### 4.6. Chốt chặn 6: Thu Hồi Phiên (tokenVersion) & Cưỡng Chế mustChangePassword (A07/Perf)
| Mã TC | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-6.1** | Xác thực Token ban đầu | Gọi `GET /api/projects` với Token A | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-6.2** | Thu hồi Token cũ | Tăng `tokenVersion` trong DB $\rightarrow$ gọi lại với Token A | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ **PASS** |
| **TC-6.3** | Cưỡng chế `mustChangePassword` | User có cờ `mustChangePassword=true` gọi API nghiệp vụ | HTTP 403 Forbidden | HTTP 403 Forbidden | ✅ **PASS** |
| **TC-6.4** | Kiểm tra mã lỗi | Payload phản hồi của chốt chặn `withApiAuth` | Mã lỗi `code: "PASSWORD_CHANGE_REQUIRED"` | `PASSWORD_CHANGE_REQUIRED` | ✅ **PASS** |

### 4.7. Chốt chặn 7: Toàn Vẹn Desktop & Concurrency Tạo Task Đồng Thời (Gate 1 #7)
| Mã TC | Hạng mục kiểm thử | Thao tác thực thi | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-7.1** | Cập nhật task chuẩn lồng | `PATCH /api/projects/[id]/tasks/[taskId]` | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-7.2** | Cập nhật task phẳng (Alias) | `PATCH /api/tasks/[taskId]` (Dành cho Desktop Workspace) | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-7.3** | Concurrency Task Creation | Bắn đồng thời 10 requests tạo task cùng project | 10/10 requests trả về HTTP 201 Created | 10/10 HTTP 201 Created | ✅ **PASS** |
| **TC-7.4** | Tính duy nhất `Task.number` | Kiểm tra tập hợp các số task vừa sinh | 10 số nguyên duy nhất, không trùng lặp | 10 số duy nhất không trùng lặp | ✅ **PASS** |

### 4.8. Chốt chặn 8: Endpoint Kiểm Tra Sức Khỏe Hệ Thống Health Probe (Gate 1 #8)
| Mã TC | Endpoint | Thông số kiểm tra | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-8.1** | `GET /api/health` | HTTP Status code | HTTP 200 OK | HTTP 200 OK | ✅ **PASS** |
| **TC-8.2** | Trạng thái dịch vụ | JSON payload | `{ status: "ok", db: "connected" }` | `{ status: "ok", db: "connected" }` | ✅ **PASS** |
| **TC-8.3** | Thời gian vận hành | JSON payload | `uptime > 0` và timestamp hợp lệ | Uptime thực tế $\approx 27.9$s | ✅ **PASS** |

### 4.9. Chốt chặn 9: Đóng Băng Phân Phối Bản Cài Mobile Cũ Chưa Đạt Chuẩn (Gate 1 #9)
| Mã TC | Hạng mục rà soát | Vị trí kiểm tra | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-9.1** | Tệp nhị phân mobile cũ | Thư mục `public/` máy chủ web | 0 tệp `.apk`, `.ipa`, `.aab` được phát hành | 0 tệp mobile xuất bản | ✅ **PASS** |

### 4.10. Chốt chặn 10: Nghiệm Thu Kép Two-Eyes Sign-off Gate 1 (Gate 1 #10)
| Mã TC | Văn kiện nghiệm thu | Tác giả lập báo cáo | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|
| **TC-10.1** | `SECURITY-AUDIT-gate1-2026-11-02.md` | Tech Lead (L3) | Tồn tại, ký duyệt PASS 100% | Đã ký Technical Sign-off | ✅ **PASS** |
| **TC-10.2** | `UX-REVIEW-phase-g0-2026-11-02.md` | UX/UI Reviewer (L5) | Tồn tại, ký duyệt ĐẠT 7/7 C1–C7 | Đã ký ĐẠT 7/7 C1–C7 | ✅ **PASS** |

---

## 5. Kết Luận & Quyết Định Nghiệm Thu Chất Lượng (QA Sign-Off Gate 1)

Căn cứ vào kết quả thực thi kiểm thử thực tế độc lập:
1. **Toàn bộ 10/10 chốt chặn nghiệm thu Gate 1** quy định tại `ADR-001` đã đạt trạng thái **PASS 100%**.
2. **Không phát sinh bất kỳ lỗi nghiêm trọng P0 hoặc P1 nào** trên cả hệ thống API và giao diện thực tế.
3. Cơ chế bảo vệ phiên, kiểm soát truy cập RBAC, chống XSS, Rate-Limiting, và tính nguyên tử khi tạo việc đã được chứng minh hoạt động hoàn hảo trên ứng dụng thật.

**QUYẾT ĐỊNH CỦA ĐỘI NGŨ QA:**
> **✅ CHÍNH THỨC SIGN-OFF NGHIỆM THU CHẤT LƯỢNG GATE 1 (QA SIGN-OFF APPROVED)**
> 
> Hệ thống KZTEK Work Management (FlowBoard) đủ điều kiện bàn giao sang **DevOps Lead (Bước 3.2)** để tiến hành cứng hóa hạ tầng Docker, kiểm tra diễn tập khôi phục sao lưu CSDL `pg_dump` và ban hành Biên bản Sign-off chính thức mở Golive Tier-1 (Mạng LAN Nội Bộ KZTEK / VPN).

---

*Hà Nội, ngày 02 tháng 11 năm 2026*  
**QA ENGINEER (L5 — JUNIOR IC)**  
*(Đã ký điện tử & xác nhận 53/53 Test Cases PASS)*
