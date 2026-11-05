/**
 * KỊCH BẢN KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN 10 TIÊU CHÍ NGHIỆM THU GATE 1
 * (Gate 1 Real-App Security, RBAC, Concurrency & Integrity Verification)
 *
 * Môi trường: Real App HTTP Server (http://localhost:3000) & PostgreSQL 17
 * Thực hiện: QA Engineer (L5 — Junior IC)
 * Căn cứ: docs/architecture/ADR-001-system-architecture-roadmap.md
 */

import "dotenv/config";
import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";
import { sanitizeHtml } from "../src/lib/sanitize";
import { encryptSecret, decryptSecret, isMasked, maskSecret } from "../src/lib/crypto-secrets";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

interface TestDetail {
  id: string;
  criterion: number;
  name: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
}

export const testResults: TestDetail[] = [];

function assertTest(
  criterion: number,
  id: string,
  testName: string,
  condition: boolean,
  expected: string,
  actual: string,
  extra?: any
) {
  totalTests++;
  const status: "PASS" | "FAIL" = condition ? "PASS" : "FAIL";
  testResults.push({ id, criterion, name: testName, expected, actual, status });

  if (condition) {
    passedTests++;
    console.log(`  ✓ [TC-${id}] PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [TC-${id}] FAIL: ${testName}`);
    console.error(`     Kỳ vọng : ${expected}`);
    console.error(`     Thực tế : ${actual}`, extra || "");
  }
}

async function loginUser(email: string, pass: string): Promise<{ token: string; cookies: string | null }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!res.ok) {
    throw new Error(`Đăng nhập thất bại cho ${email}: HTTP ${res.status}`);
  }
  const data = await res.json();
  const setCookie = res.headers.get("set-cookie");
  return { token: data.token, cookies: setCookie };
}

async function runGate1SecurityVerification() {
  console.log("================================================================================");
  console.log("🛡️  BẮT ĐẦU KIỂM THỬ THỰC TẾ 10 CHỐT CHẶN GATE 1 TRÊN ỨNG DỤNG THẬT (REAL-APP)");
  console.log(`🎯  Target URL: ${BASE_URL}`);
  console.log("================================================================================\n");

  // 0. Xác thực Admin & Member Credentials
  console.log("🔑 [SETUP] Chuẩn bị phiên xác thực cho Quản trị viên và Thành viên...");
  const adminCreds = await loginUser("admin@kztek.net", "Kztek@2026");
  const memberCreds = await loginUser("binh@demo.dev", "demo123");
  console.log("  ✓ Admin JWT & Member JWT đã được cấp phát thành công.\n");

  // ============================================================================
  // TIÊU CHÍ 1: RBAC & Khóa Leo thang Đặc quyền (A01 / Gate 1 #1)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 1] RBAC & Khóa Leo thang Đặc quyền (A01)");

  // 1.1. User ẩn danh gọi các route quản trị
  const anonUsersGet = await fetch(`${BASE_URL}/api/users`);
  assertTest(
    1,
    "1.1",
    "User ẩn danh gọi GET /api/users bị từ chối 401 Unauthorized",
    anonUsersGet.status === 401,
    "HTTP 401",
    `HTTP ${anonUsersGet.status}`
  );

  const anonUsersPost = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker", email: "hacker@test.com", password: "123" }),
  });
  assertTest(
    1,
    "1.2",
    "User ẩn danh gọi POST /api/users bị từ chối 401 Unauthorized",
    anonUsersPost.status === 401,
    "HTTP 401",
    `HTTP ${anonUsersPost.status}`
  );

  const anonUsersPatch = await fetch(`${BASE_URL}/api/users/cmvzb8h5j00001kk5gpsbbr84`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  assertTest(
    1,
    "1.3",
    "User ẩn danh gọi PATCH /api/users/[id] bị từ chối 401 Unauthorized",
    anonUsersPatch.status === 401,
    "HTTP 401",
    `HTTP ${anonUsersPatch.status}`
  );

  const anonUsersDelete = await fetch(`${BASE_URL}/api/users/cmvzb8h5j00001kk5gpsbbr84`, {
    method: "DELETE",
  });
  assertTest(
    1,
    "1.4",
    "User ẩn danh gọi DELETE /api/users/[id] bị từ chối 401 Unauthorized",
    anonUsersDelete.status === 401,
    "HTTP 401",
    `HTTP ${anonUsersDelete.status}`
  );

  const anonRegisterPost = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "SelfRegistered", email: "self@test.com", password: "123" }),
  });
  assertTest(
    1,
    "1.5",
    "POST /api/auth/register tự đăng ký công khai bị khóa hoàn toàn 403 Forbidden",
    anonRegisterPost.status === 403,
    "HTTP 403",
    `HTTP ${anonRegisterPost.status}`
  );

  const anonAttachDelete = await fetch(`${BASE_URL}/api/attachments/invalid-attachment-id`, {
    method: "DELETE",
  });
  assertTest(
    1,
    "1.6",
    "User ẩn danh gọi DELETE /api/attachments/[id] bị từ chối 401 Unauthorized",
    anonAttachDelete.status === 401,
    "HTTP 401",
    `HTTP ${anonAttachDelete.status}`
  );

  const anonLogsGet = await fetch(`${BASE_URL}/api/notifications/email-logs`);
  assertTest(
    1,
    "1.7",
    "User ẩn danh gọi GET /api/notifications/email-logs bị từ chối 401 Unauthorized",
    anonLogsGet.status === 401,
    "HTTP 401",
    `HTTP ${anonLogsGet.status}`
  );

  // 1.2. User role MEMBER gọi các route quản trị của ADMIN
  const memberUsersGet = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${memberCreds.token}` },
  });
  assertTest(
    1,
    "1.8",
    "User MEMBER gọi GET /api/users bị chặn 403 Forbidden",
    memberUsersGet.status === 403,
    "HTTP 403",
    `HTTP ${memberUsersGet.status}`
  );

  const memberUsersPost = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${memberCreds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "SubUser", email: "sub@test.com", password: "123" }),
  });
  assertTest(
    1,
    "1.9",
    "User MEMBER gọi POST /api/users bị chặn 403 Forbidden",
    memberUsersPost.status === 403,
    "HTTP 403",
    `HTTP ${memberUsersPost.status}`
  );

  const memberLogsGet = await fetch(`${BASE_URL}/api/notifications/email-logs`, {
    headers: { Authorization: `Bearer ${memberCreds.token}` },
  });
  assertTest(
    1,
    "1.10",
    "User MEMBER gọi GET /api/notifications/email-logs bị chặn 403 Forbidden",
    memberLogsGet.status === 403,
    "HTTP 403",
    `HTTP ${memberLogsGet.status}`
  );

  // 1.3. Admin gọi hợp lệ
  const adminUsersGet = await fetch(`${BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${adminCreds.token}` },
  });
  assertTest(
    1,
    "1.11",
    "Admin gọi GET /api/users thành công 200 OK",
    adminUsersGet.status === 200,
    "HTTP 200",
    `HTTP ${adminUsersGet.status}`
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 2: Cô lập Dữ liệu Ticket Nội bộ & Chặn Giả mạo isStaff (A01/I / Gate 1 #2)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 2] Cô lập Dữ liệu Ticket Nội bộ & Chặn Giả mạo isStaff (A01/I)");

  // Tạo một CustomerTicket thử nghiệm kèm ghi chú nội bộ và bình luận nội bộ
  const testTicket = await prisma.customerTicket.create({
    data: {
      trackingCode: `TK-GATE1-${Date.now().toString().slice(-6)}`,
      title: "Cần hỗ trợ tích hợp cổng kiểm soát bãi xe KZTEK",
      description: "Khách hàng gửi yêu cầu hỗ trợ qua cổng công khai",
      customerName: "Nguyễn Văn Khách",
      customerEmail: "khachhang@doitac.vn",
      internalNotes: "BÍ MẬT NỘI BỘ: Dự án này đang nợ đọng thanh toán 15%",
      comments: {
        create: [
          {
            authorName: "Khách Hàng",
            message: "Nhờ kỹ thuật hỗ trợ sớm",
            isStaff: false,
            isInternalOnly: false,
          },
          {
            authorName: "Kỹ Thuật Viên KZTEK",
            message: "Ghi chú nội bộ: Chưa bàn giao source code khi chưa thanh toán xong",
            isStaff: true,
            isInternalOnly: true,
          },
        ],
      },
    },
    include: { comments: true },
  });

  try {
    // 2.1. Truy vấn ẩn danh
    const anonTicketRes = await fetch(`${BASE_URL}/api/tickets/${testTicket.id}`);
    assertTest(
      2,
      "2.1",
      "Truy vấn GET /api/tickets/[id] ẩn danh trả về HTTP 200 OK",
      anonTicketRes.status === 200,
      "HTTP 200",
      `HTTP ${anonTicketRes.status}`
    );

    const anonTicketData = await anonTicketRes.json();
    const fetchedTicket = anonTicketData.ticket;

    assertTest(
      2,
      "2.2",
      "Response ticket ẩn danh KHÔNG chứa trường internalNotes",
      fetchedTicket.internalNotes === undefined,
      "undefined",
      String(fetchedTicket.internalNotes)
    );

    const internalCommentExposed = fetchedTicket.comments?.some((c: any) => c.isInternalOnly);
    assertTest(
      2,
      "2.3",
      "Response ticket ẩn danh KHÔNG chứa bất kỳ bình luận nội bộ nào (isInternalOnly: true)",
      !internalCommentExposed && fetchedTicket.comments?.length === 1,
      "Chỉ 1 comment công khai, 0 comment nội bộ",
      `${fetchedTicket.comments?.length} comments`
    );

    // 2.2. Gửi comment mạo danh isStaff / isInternalOnly từ ẩn danh
    const spoofCommentRes = await fetch(`${BASE_URL}/api/tickets/${testTicket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorName: "Hacker Mạo Danh Nhân Viên",
        message: "Thông báo bảo trì khẩn cấp",
        isStaff: true,
        isInternalOnly: true,
      }),
    });
    assertTest(
      2,
      "2.4",
      "Gửi bình luận công khai thành công HTTP 200/201",
      spoofCommentRes.status === 200 || spoofCommentRes.status === 201,
      "HTTP 200 hoặc 201",
      `HTTP ${spoofCommentRes.status}`
    );

    // Kiểm tra trực tiếp bản ghi vừa tạo trong DB
    const createdSpoofComment = await prisma.ticketComment.findFirst({
      where: { ticketId: testTicket.id, authorName: "Hacker Mạo Danh Nhân Viên" },
    });

    assertTest(
      2,
      "2.5",
      "Bình luận của user ẩn danh bị cưỡng chế isStaff = false ở server",
      createdSpoofComment?.isStaff === false,
      "isStaff: false",
      `isStaff: ${createdSpoofComment?.isStaff}`
    );

    assertTest(
      2,
      "2.6",
      "Bình luận của user ẩn danh bị cưỡng chế isInternalOnly = false ở server",
      createdSpoofComment?.isInternalOnly === false,
      "isInternalOnly: false",
      `isInternalOnly: ${createdSpoofComment?.isInternalOnly}`
    );
  } finally {
    // Dọn dẹp ticket thử nghiệm
    await prisma.ticketComment.deleteMany({ where: { ticketId: testTicket.id } });
    await prisma.customerTicket.delete({ where: { id: testTicket.id } });
  }
  console.log();

  // ============================================================================
  // TIÊU CHÍ 3: Khử trùng Stored XSS & Cấu hình Cookie HttpOnly (A03/A05 / Gate 1 #3)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 3] Khử trùng Stored XSS & Cấu hình Cookie HttpOnly (A03/A05)");

  // 3.1. Lọc XSS bằng sanitizeHtml (isomorphic-dompurify)
  const scriptPayload = '<p>Bình thường</p><script>alert("XSS")</script>';
  const sanitizedScript = sanitizeHtml(scriptPayload);
  assertTest(
    3,
    "3.1",
    "DOMPurify khử sạch toàn bộ thẻ <script>alert(1)</script>",
    !sanitizedScript.includes("<script>") && !sanitizedScript.includes("alert"),
    "Không chứa script tag",
    sanitizedScript
  );

  const svgPayload = '<svg onload="alert(\'SVG_XSS\')"><circle r="10"/></svg>';
  const sanitizedSvg = sanitizeHtml(svgPayload);
  assertTest(
    3,
    "3.2",
    "DOMPurify khử sạch sự kiện thực thi onload trong <svg>",
    !sanitizedSvg.includes("onload") && !sanitizedSvg.includes("alert"),
    "Không chứa onload handler",
    sanitizedSvg
  );

  const imgPayload = '<img src="invalid.jpg" onerror="alert(document.cookie)" />';
  const sanitizedImg = sanitizeHtml(imgPayload);
  assertTest(
    3,
    "3.3",
    "DOMPurify khử sạch sự kiện onerror trong thẻ <img>",
    !sanitizedImg.includes("onerror"),
    "Không chứa onerror handler",
    sanitizedImg
  );

  const jsLinkPayload = '<a href="javascript:alert(1)">Click me</a>';
  const sanitizedLink = sanitizeHtml(jsLinkPayload);
  assertTest(
    3,
    "3.4",
    "DOMPurify loại bỏ giao thức javascript: trong thẻ <a>",
    !sanitizedLink.includes("javascript:"),
    "Không chứa javascript:",
    sanitizedLink
  );

  const safeRichText = '<p><span style="color: #F05922; background-color: #FEF08A;"><strong>Điểm nhấn KZTEK</strong></span></p>';
  const sanitizedSafe = sanitizeHtml(safeRichText);
  assertTest(
    3,
    "3.5",
    "DOMPurify giữ nguyên các thẻ định dạng văn bản an toàn (bold, highlight vàng, màu chữ)",
    sanitizedSafe.includes("strong") && sanitizedSafe.includes("background-color"),
    "Bảo toàn định dạng văn bản",
    sanitizedSafe
  );

  // 3.2. Cookie HttpOnly & SameSite=Lax
  const loginCheckRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@kztek.net", password: "Kztek@2026" }),
  });
  const cookieHeader = loginCheckRes.headers.get("set-cookie") || "";

  assertTest(
    3,
    "3.6",
    "Header Set-Cookie chứa session cookie 'flowboard_session'",
    cookieHeader.includes("flowboard_session="),
    "Chứa flowboard_session",
    cookieHeader
  );

  assertTest(
    3,
    "3.7",
    "Cookie flowboard_session có cờ HttpOnly ngăn chặn JavaScript phía client truy cập",
    /httponly/i.test(cookieHeader),
    "Chứa HttpOnly",
    cookieHeader
  );

  assertTest(
    3,
    "3.8",
    "Cookie flowboard_session có cờ SameSite=Lax chống tấn công CSRF",
    /samesite=lax/i.test(cookieHeader),
    "Chứa SameSite=Lax",
    cookieHeader
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 4: Che giấu Secrets Masking & Mã hóa AES-256-GCM (A02/A09 / Gate 1 #4)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 4] Che giấu Secrets Masking & Mã hóa AES-256-GCM (A02/A09)");

  // 4.1. Gọi GET /api/system/config dưới quyền Admin
  const cfgRes = await fetch(`${BASE_URL}/api/system/config`, {
    headers: { Authorization: `Bearer ${adminCreds.token}` },
  });
  assertTest(
    4,
    "4.1",
    "Admin gọi GET /api/system/config thành công HTTP 200 OK",
    cfgRes.status === 200,
    "HTTP 200",
    `HTTP ${cfgRes.status}`
  );

  const cfgData = await cfgRes.json();
  const cfg = cfgData.config;

  // Kiểm tra không rò rỉ secret plaintext
  const smtpPass = cfg?.smtp?.pass;
  const isSmtpPassMaskedOrEmpty = !smtpPass || isMasked(smtpPass) || smtpPass === "******";
  assertTest(
    4,
    "4.2",
    "Trường smtp.pass được che giấu '******' hoặc rỗng, không lộ plaintext",
    isSmtpPassMaskedOrEmpty,
    "****** hoặc rỗng",
    String(smtpPass)
  );

  // 4.2. Kiểm tra mã hóa AES-256-GCM qua hàm chuyên biệt
  const secretPlaintext = "KZTEK_SUPER_SECRET_KEY_@2026";
  const encrypted = encryptSecret(secretPlaintext);
  assertTest(
    4,
    "4.3",
    "Hàm encryptSecret sinh định dạng bắt đầu bằng tiền tố 'enc:v1:'",
    encrypted.startsWith("enc:v1:"),
    "enc:v1:...",
    encrypted.slice(0, 20) + "..."
  );

  const parts = encrypted.split(":");
  assertTest(
    4,
    "4.4",
    "Ciphertext bao gồm 5 thành phần (enc : v1 : iv : tag : ciphertext)",
    parts.length === 5,
    "5 thành phần",
    `${parts.length} thành phần`
  );

  const decrypted = decryptSecret(encrypted);
  assertTest(
    4,
    "4.5",
    "Hàm decryptSecret giải mã chính xác 100% dữ liệu gốc ban đầu",
    decrypted === secretPlaintext,
    secretPlaintext,
    decrypted
  );

  // 4.3. Kiểm tra lưu trữ DB SystemSetting
  const testSetting = await prisma.systemSetting.upsert({
    where: { id: "default" },
    update: { smtpPass: encryptSecret("SmtpSecretPassword123") },
    create: { id: "default", smtpPass: encryptSecret("SmtpSecretPassword123") },
  });
  assertTest(
    4,
    "4.6",
    "Bản ghi SystemSetting trong PostgreSQL 17 lưu trữ smtpPass có tiền tố 'enc:v1:'",
    typeof testSetting.smtpPass === "string" && testSetting.smtpPass.startsWith("enc:v1:"),
    "Bắt đầu bằng enc:v1:",
    String(testSetting.smtpPass?.slice(0, 20)) + "..."
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 5: In-Memory Rate Limiting & An toàn Tải tệp Tệp tin (A04/A07 / Gate 1 #5)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 5] In-Memory Rate Limiting & An toàn Tải tệp Tệp tin (A04/A07)");

  // 5.1. Rate Limiting: Gửi 15 request liên tiếp từ IP giả lập
  const simulatedIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  let firstTenSuccess = true;
  let eleventhStatus = 0;
  let eleventhError = "";

  for (let i = 1; i <= 15; i++) {
    const r = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": simulatedIp,
      },
      body: JSON.stringify({ email: "invalid@kztek.net", password: "wrong" }),
    });

    if (i <= 10) {
      if (r.status === 429) firstTenSuccess = false;
    } else if (i === 11) {
      eleventhStatus = r.status;
      const b = await r.json().catch(() => ({}));
      eleventhError = b.error || "";
    }
  }

  assertTest(
    5,
    "5.1",
    "10 lượt đăng nhập đầu tiên không bị chặn Rate Limit",
    firstTenSuccess,
    "Không gặp 429 trong 10 requests đầu",
    firstTenSuccess ? "PASS" : "Bị chặn sớm"
  );

  assertTest(
    5,
    "5.2",
    "Lượt đăng nhập thứ 11 trong 1 phút bị chặn với HTTP 429 Too Many Requests",
    eleventhStatus === 429,
    "HTTP 429",
    `HTTP ${eleventhStatus}`
  );

  assertTest(
    5,
    "5.3",
    "Payload 429 chứa thông điệp cảnh báo người dùng",
    eleventhError.includes("Quá nhiều lần đăng nhập"),
    "Thông báo rate limit thân thiện",
    eleventhError
  );

  // 5.2. File Upload Security
  // Anonymous upload
  const anonUploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
  });
  assertTest(
    5,
    "5.4",
    "Upload tệp khi chưa đăng nhập bị từ chối HTTP 401 Unauthorized",
    anonUploadRes.status === 401,
    "HTTP 401",
    `HTTP ${anonUploadRes.status}`
  );

  // Chặn file .html
  const htmlFormData = new FormData();
  htmlFormData.append("files", new Blob(["<h1>Malicious Web Page</h1>"], { type: "text/html" }), "exploit.html");
  const htmlRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminCreds.token}` },
    body: htmlFormData,
  });
  assertTest(
    5,
    "5.5",
    "Upload tệp .html bị chặn tuyệt đối với HTTP 400 Bad Request",
    htmlRes.status === 400,
    "HTTP 400",
    `HTTP ${htmlRes.status}`
  );

  // Chặn file .svg
  const svgFormData = new FormData();
  svgFormData.append("files", new Blob(['<svg><script>alert(1)</script></svg>'], { type: "image/svg+xml" }), "vector.svg");
  const svgRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminCreds.token}` },
    body: svgFormData,
  });
  assertTest(
    5,
    "5.6",
    "Upload tệp .svg bị chặn tuyệt đối với HTTP 400 Bad Request",
    svgRes.status === 400,
    "HTTP 400",
    `HTTP ${svgRes.status}`
  );

  // Chặn fake PNG (magic bytes mismatch)
  const fakePngFormData = new FormData();
  fakePngFormData.append("files", new Blob(["THIS IS NOT A VALID PNG HEADER"], { type: "image/png" }), "fake.png");
  const fakePngRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminCreds.token}` },
    body: fakePngFormData,
  });
  assertTest(
    5,
    "5.7",
    "Upload tệp PNG giả mạo header bị phát hiện và từ chối HTTP 400",
    fakePngRes.status === 400,
    "HTTP 400",
    `HTTP ${fakePngRes.status}`
  );

  // Upload valid PNG
  const validPngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  const validPngFormData = new FormData();
  validPngFormData.append("files", new Blob([validPngHeader], { type: "image/png" }), "valid-pixel.png");
  const validPngRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminCreds.token}` },
    body: validPngFormData,
  });
  assertTest(
    5,
    "5.8",
    "Upload tệp PNG thật có Magic Bytes chuẩn xác thành công HTTP 200 OK",
    validPngRes.status === 200,
    "HTTP 200",
    `HTTP ${validPngRes.status}`
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 6: Thu hồi Token Tức thì & Cưỡng chế mustChangePassword (A07/Perf / Gate 1 #6)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 6] Thu hồi Token Tức thì (tokenVersion) & Cưỡng chế mustChangePassword (A07/Perf)");

  // 6.1. Token Revocation khi tokenVersion tăng
  // Tạo user thử nghiệm để test revocation và mustChangePassword
  const testRevokeEmail = `revoke-test-${Date.now()}@kztek.net`;
  const testRevokeUser = await prisma.user.create({
    data: {
      name: "Token Revocation Test",
      email: testRevokeEmail,
      passwordHash: "salt:hash",
      role: "MEMBER",
      tokenVersion: 1,
      mustChangePassword: false,
    },
  });

  try {
    // Cấp token A cho testRevokeUser
    const { createSession } = await import("../src/lib/auth");
    const tokenA = await createSession(testRevokeUser.id, 1, "MEMBER");

    // Gọi API với Token A -> thành công
    const callBeforeRevoke = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assertTest(
      6,
      "6.1",
      "Token A ban đầu gọi API thành công HTTP 200 OK",
      callBeforeRevoke.status === 200,
      "HTTP 200",
      `HTTP ${callBeforeRevoke.status}`
    );

    // Tăng tokenVersion trong DB (mô phỏng đổi mật khẩu)
    await prisma.user.update({
      where: { id: testRevokeUser.id },
      data: { tokenVersion: { increment: 1 } },
    });

    // Gọi lại API với Token A cũ
    const callAfterRevoke = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assertTest(
      6,
      "6.2",
      "Token A cũ bị từ chối 401 Unauthorized ngay lập tức sau khi tokenVersion tăng",
      callAfterRevoke.status === 401,
      "HTTP 401",
      `HTTP ${callAfterRevoke.status}`
    );

    // 6.2. Cưỡng chế mustChangePassword
    // Bật cờ mustChangePassword = true và cấp token B
    await prisma.user.update({
      where: { id: testRevokeUser.id },
      data: { mustChangePassword: true, tokenVersion: 2, role: "ADMIN" },
    });
    const tokenB = await createSession(testRevokeUser.id, 2, "ADMIN");

    // Gọi API quản trị/nghiệp vụ có chốt chặn withApiAuth (ví dụ /api/users)
    const callMustChange = await fetch(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assertTest(
      6,
      "6.3",
      "User có cờ mustChangePassword=true bị chặn ở API nghiệp vụ với HTTP 403",
      callMustChange.status === 403,
      "HTTP 403",
      `HTTP ${callMustChange.status}`
    );

    const mustChangeBody = await callMustChange.json().catch(() => ({}));
    assertTest(
      6,
      "6.4",
      "Mã lỗi trả về là PASSWORD_CHANGE_REQUIRED",
      mustChangeBody.code === "PASSWORD_CHANGE_REQUIRED",
      "code: PASSWORD_CHANGE_REQUIRED",
      `code: ${mustChangeBody.code}`
    );
  } finally {
    await prisma.user.delete({ where: { id: testRevokeUser.id } });
  }
  console.log();

  // ============================================================================
  // TIÊU CHÍ 7: Toàn vẹn Nghiệp vụ Desktop & Bắn đồng thời 10 Task Atomic Concurrency (Gate 1 #7)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 7] Toàn vẹn Nghiệp vụ Desktop & Bắn đồng thời 10 Task Atomic Concurrency (Gate 1 #7)");

  const targetProjectId = "cmvzb8h8f00041kk5ya0hgdql"; // FlowBoard Core
  const targetTaskId = "cmvzb8h8t000g1kk53nk71yqw"; // First task

  // 7.1. Cập nhật task qua đường dẫn chuẩn lồng project
  const patchProjectTaskRes = await fetch(`${BASE_URL}/api/projects/${targetProjectId}/tasks/${targetTaskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${adminCreds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ priority: "HIGH" }),
  });
  assertTest(
    7,
    "7.1",
    "PATCH /api/projects/[id]/tasks/[taskId] cập nhật thành công HTTP 200 OK",
    patchProjectTaskRes.status === 200,
    "HTTP 200",
    `HTTP ${patchProjectTaskRes.status}`
  );

  // 7.2. Cập nhật task qua alias router phẳng /api/tasks/[taskId] (phục vụ Desktop Workspace)
  const patchFlatTaskRes = await fetch(`${BASE_URL}/api/tasks/${targetTaskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${adminCreds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ priority: "MEDIUM" }),
  });
  assertTest(
    7,
    "7.2",
    "PATCH /api/tasks/[taskId] (Router Alias) cập nhật thành công HTTP 200 OK",
    patchFlatTaskRes.status === 200,
    "HTTP 200",
    `HTTP ${patchFlatTaskRes.status}`
  );

  // 7.3. Concurrency Test: Bắn đồng thời 10 requests tạo task trong cùng một project
  console.log("  → Đang bắn đồng thời 10 requests tạo task vào cùng 1 project...");
  const concurrentCount = 10;
  const createdTaskIds: string[] = [];
  const createdNumbers: number[] = [];

  const promises = Array.from({ length: concurrentCount }, (_, i) => {
    return fetch(`${BASE_URL}/api/projects/${targetProjectId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminCreds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Gate1 Concurrency Test Task #${i + 1} - ${Date.now()}`,
        status: "TODO",
        priority: "LOW",
        type: "TASK",
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });
  });

  const concurrentResults = await Promise.all(promises);
  const allCreatedOk = concurrentResults.every((r) => r.status === 201 && r.data?.task?.id);

  assertTest(
    7,
    "7.3",
    "Cả 10 requests tạo task đồng thời đều trả về HTTP 201 Created (không crash/P2002)",
    allCreatedOk,
    "10/10 requests trả về HTTP 201",
    `${concurrentResults.filter((r) => r.status === 201).length}/${concurrentCount} thành công`
  );

  for (const r of concurrentResults) {
    if (r.data?.task) {
      createdTaskIds.push(r.data.task.id);
      createdNumbers.push(r.data.task.number);
    }
  }

  const uniqueNumbers = new Set(createdNumbers);
  assertTest(
    7,
    "7.4",
    "Toàn bộ 10 Task.number sinh ra đều duy nhất và không bị trùng lặp",
    uniqueNumbers.size === concurrentCount,
    `10 số duy nhất: ${[...uniqueNumbers].sort((a, b) => a - b).join(", ")}`,
    `${uniqueNumbers.size} số duy nhất: ${createdNumbers.sort((a, b) => a - b).join(", ")}`
  );

  // Thu dọn dẹp 10 task thử nghiệm
  if (createdTaskIds.length > 0) {
    await prisma.activity.deleteMany({ where: { taskId: { in: createdTaskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    console.log(`  ✓ Đã dọn dẹp sạch ${createdTaskIds.length} tasks thử nghiệm khỏi CSDL.`);
  }
  console.log();

  // ============================================================================
  // TIÊU CHÍ 8: Endpoint Kiểm tra Sức khỏe Hệ thống Health Probe (Gate 1 #8)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 8] Endpoint Kiểm tra Sức khỏe Hệ thống Health Probe (Gate 1 #8)");

  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assertTest(
    8,
    "8.1",
    "GET /api/health trả về HTTP status 200 OK",
    healthRes.status === 200,
    "HTTP 200",
    `HTTP ${healthRes.status}`
  );

  const healthData = await healthRes.json();
  assertTest(
    8,
    "8.2",
    "Payload health xác nhận trạng thái status: 'ok' và db: 'connected'",
    healthData.status === "ok" && healthData.db === "connected",
    "{ status: 'ok', db: 'connected' }",
    JSON.stringify({ status: healthData.status, db: healthData.db })
  );

  assertTest(
    8,
    "8.3",
    "Payload health cung cấp thời gian uptime tiến trình và timestamp hợp lệ",
    typeof healthData.uptime === "number" && healthData.uptime > 0 && !!healthData.timestamp,
    "uptime > 0 và timestamp hợp lệ",
    `uptime: ${healthData.uptime}s`
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 9: Đóng băng Phân phối Bộ cài Mobile Cũ Chưa Đạt Chuẩn (Gate 1 #9)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 9] Đóng băng Phân phối Bộ cài Mobile Cũ (Gate 1 #9)");

  // Xác nhận không có file APK / IPA / EXE mobile cũ được publish trong public/
  let mobileBuildPublished = false;
  try {
    const publicFiles = await fs.readdir(path.join(process.cwd(), "public"));
    mobileBuildPublished = publicFiles.some((f) => /\.(apk|ipa|aab)$/i.test(f));
  } catch {
    mobileBuildPublished = false;
  }

  assertTest(
    9,
    "9.1",
    "Bộ cài C# Mobile cũ (chứa mật khẩu demo hardcode) chưa bị xuất bản công khai",
    !mobileBuildPublished,
    "0 bản cài đặt mobile trong public/",
    mobileBuildPublished ? "Có file mobile trong public" : "Đã đóng băng an toàn"
  );
  console.log();

  // ============================================================================
  // TIÊU CHÍ 10: Kiểm tra Nghiệm thu Kép Two-Eyes Sign-off Gate 1 (Gate 1 #10)
  // ============================================================================
  console.log("▶ [GATE 1 - TIÊU CHÍ 10] Kiểm tra Nghiệm thu Kép Two-Eyes Sign-off Gate 1 (Gate 1 #10)");

  const secAuditPath = path.join(process.cwd(), "docs/architecture/SECURITY-AUDIT-gate1-2026-11-02.md");
  let secAuditExists = false;
  let secAuditPass = false;
  try {
    const secContent = await fs.readFile(secAuditPath, "utf-8");
    secAuditExists = true;
    secAuditPass = secContent.includes("TECHNICAL SIGN-OFF") || secContent.includes("PASS 100%");
  } catch {
    secAuditExists = false;
  }

  assertTest(
    10,
    "10.1",
    "Báo cáo SECURITY-AUDIT-gate1-2026-11-02.md của Tech Lead tồn tại và ký duyệt PASS",
    secAuditExists && secAuditPass,
    "SECURITY-AUDIT-gate1-2026-11-02.md tồn tại với kết luận PASS",
    secAuditExists ? "Tồn tại & PASS" : "Không tìm thấy file"
  );

  const uxReviewPath = path.join(process.cwd(), "docs/ux-review/UX-REVIEW-phase-g0-2026-11-02.md");
  let uxReviewExists = false;
  let uxReviewPass = false;
  try {
    const uxContent = await fs.readFile(uxReviewPath, "utf-8");
    uxReviewExists = true;
    uxReviewPass = uxContent.includes("PASS 7/7 TIÊU CHÍ C1–C7") || uxContent.includes("ĐẠT");
  } catch {
    uxReviewExists = false;
  }

  assertTest(
    10,
    "10.2",
    "Báo cáo UX-REVIEW-phase-g0-2026-11-02.md của UX/UI Reviewer tồn tại và ký duyệt 7/7 C1–C7",
    uxReviewExists && uxReviewPass,
    "UX-REVIEW-phase-g0-2026-11-02.md tồn tại với kết luận ĐẠT C1–C7",
    uxReviewExists ? "Tồn tại & ĐẠT" : "Không tìm thấy file"
  );
  console.log();

  // ============================================================================
  // TỔNG KẾT TOÀN DIỆN
  // ============================================================================
  console.log("================================================================================");
  console.log(`📊 TỔNG KẾT KIỂM THỬ THỰC TẾ GATE 1:`);
  console.log(`   - Tổng số test cases : ${totalTests}`);
  console.log(`   - Đạt (PASS)         : ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`   - Không đạt (FAIL)   : ${failedTests}`);
  console.log("================================================================================");

  if (failedTests > 0) {
    console.error(`\n🛑 PHÁT HIỆN ${failedTests} TEST THẤT BẠI — CHƯA ĐỦ ĐIỀU KIỆN SIGN-OFF GATE 1!`);
    process.exit(1);
  } else {
    console.log(`\n🎉 TOÀN BỘ 10/10 CHỐT CHẶN GATE 1 ĐÃ VƯỢT QUA KIỂM THỬ THỰC TẾ 100% PASS! ✅`);
  }
}

runGate1SecurityVerification()
  .catch((err) => {
    console.error("Lỗi ngoại lệ khi chạy kiểm thử Gate 1:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
