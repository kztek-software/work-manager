import "dotenv/config";
import { sanitizeHtml } from "../src/lib/sanitize";
import { escapeHtml, generateTaskAssignedEmailHtml, generateTaskCommentEmailHtml } from "../src/lib/mail";
import { encryptSecret, decryptSecret, maskSecret, isMasked, isEncrypted } from "../src/lib/crypto-secrets";
import { getMaskedSystemConfig, updateSystemConfigAsync, getSystemConfigAsync } from "../src/lib/system-config";
import fs from "node:fs";
import path from "node:path";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ BƯỚC 1.2 — XSS, COOKIE & SECRET ENCRYPTION");
  console.log("==================================================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Chi tiết: ${detail}`);
      failCount++;
    }
  }

  // --- PHẦN 1: CHỐNG XSS DOMPURIFY (src/lib/sanitize.ts) ---
  console.log("--- 1. Kiểm thử chống XSS DOMPurify ---");
  const xssScript = sanitizeHtml('<script>alert("xss")</script>');
  assert(!xssScript.includes("<script>") && !xssScript.includes("alert"), "Lọc sạch thẻ <script>");

  const xssSvg = sanitizeHtml('<svg onload="alert(1)"><circle r="10"/></svg>');
  assert(!xssSvg.includes("onload") && !xssSvg.includes("<svg"), "Lọc sạch thẻ <svg onload>");

  const xssImg = sanitizeHtml('<img src="x" onerror="alert(1)">');
  assert(!xssImg.includes("onerror") && !xssImg.includes("<img"), "Lọc sạch thẻ <img onerror>");

  const xssHref = sanitizeHtml('<a href="javascript:alert(1)">Click Me</a>');
  assert(!xssHref.includes("javascript:"), "Lọc sạch giao thức javascript: trong thẻ <a>");

  const safeRichText = sanitizeHtml('<p style="color: red;" class="prose"><strong>Bold text</strong></p>');
  assert(
    safeRichText.includes("<strong>Bold text</strong>") && safeRichText.includes("color: red"),
    "Giữ nguyên định dạng rich-text an toàn KZTEK"
  );

  // --- PHẦN 2: EMAIL HTML ESCAPE & TLS (src/lib/mail.ts) ---
  console.log("\n--- 2. Kiểm thử Email HTML Escape & TLS ---");
  const escaped = escapeHtml('<script>alert("hack")</script>');
  assert(
    escaped === "&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;",
    "Hàm escapeHtml mã hóa ký tự nhạy cảm HTML đúng chuẩn"
  );

  const emailHtml = generateTaskAssignedEmailHtml({
    taskNumber: 101,
    taskTitle: '<b onmouseover="alert(1)">Title XSS</b>',
    taskType: "TASK",
    priority: "HIGH",
    projectName: 'Dự án <img onerror="hack">',
    projectKey: "KZ",
    projectId: "proj-1",
    assignorName: '<script>Hack</script>',
    assigneeName: "Nguyễn Văn A",
    assigneeEmail: "a@kztek.net",
  });
  assert(
    !emailHtml.includes("<script>") && !emailHtml.includes('onmouseover="alert(1)"') && !emailHtml.includes('<img onerror="hack">'),
    "generateTaskAssignedEmailHtml đã khử trùng an toàn các biến dữ liệu người dùng"
  );

  const commentHtml = generateTaskCommentEmailHtml({
    taskNumber: 102,
    taskTitle: "Bình luận task",
    projectName: "Dự án KZTEK",
    projectId: "proj-1",
    authorName: 'Admin <svg onload=1>',
    commentBody: '<script>bad()</script>',
    recipientName: "B",
    recipientEmail: "b@kztek.net",
  });
  assert(
    !commentHtml.includes("<script>bad()</script>") && !commentHtml.includes("<svg onload=1>"),
    "generateTaskCommentEmailHtml đã escape commentBody và authorName"
  );

  // --- PHẦN 3: COOKIE HTTPONLY (src/lib/auth.ts) ---
  console.log("\n--- 3. Kiểm thử Cấu hình Cookie HttpOnly ---");
  const authFileContent = fs.readFileSync(path.join(__dirname, "../src/lib/auth.ts"), "utf-8");
  assert(
    authFileContent.includes("store.set(COOKIE_NAME, token, {\n      httpOnly: true,\n      sameSite: \"lax\",") ||
    authFileContent.includes("httpOnly: true"),
    "Cookie flowboard_session được cấu hình httpOnly: true"
  );
  assert(
    authFileContent.includes('secure: process.env.COOKIE_SECURE === "true"'),
    "Cookie flowboard_session tương thích kép mạng LAN HTTP và HTTPS"
  );

  // --- PHẦN 4: MÃ HÓA SECRETS AES-256-GCM (src/lib/crypto-secrets.ts) ---
  console.log("\n--- 4. Kiểm thử Mã hóa Secrets AES-256-GCM ---");
  const secretPlain = "kztek-smtp-super-secret-password-2026";
  const encrypted = encryptSecret(secretPlain);
  assert(isEncrypted(encrypted), "encryptSecret tạo ra định dạng bắt đầu bằng enc:v1:");
  assert(encrypted.startsWith("enc:v1:"), "enc:v1: tiền tố đúng chuẩn");

  const parts = encrypted.slice("enc:v1:".length).split(":");
  assert(parts.length === 3, "Payload mã hóa gồm 3 phần: iv, tag, ciphertext");

  const decrypted = decryptSecret(encrypted);
  assert(decrypted === secretPlain, "decryptSecret khôi phục chính xác plaintext");

  const oldPlaintext = "old-legacy-password-unencrypted";
  assert(decryptSecret(oldPlaintext) === oldPlaintext, "decryptSecret tương thích ngược hoàn hảo dữ liệu plaintext cũ");

  assert(maskSecret(secretPlain) === "******", "maskSecret trả về '******'");
  assert(maskSecret("") === "", "maskSecret trả về rỗng khi chuỗi rỗng");
  assert(isMasked("******"), "isMasked nhận diện '******'");
  assert(isMasked("••••••••••••"), "isMasked nhận diện bullet mask '••••••••••••'");

  // --- PHẦN 5: SYSTEM CONFIG & SSRF PROTECTION ---
  console.log("\n--- 5. Kiểm thử SystemConfig Masking & Chống SSRF ---");
  const maskedCfg = getMaskedSystemConfig();
  if (maskedCfg.smtp.pass) {
    assert(maskedCfg.smtp.pass === "******", "GET /api/system/config che mật khẩu smtp.pass bằng ******");
  }

  // SSRF Protection Test
  let ssrfBlocked = false;
  try {
    await updateSystemConfigAsync({
      discord: {
        webhookUrl: "http://169.254.169.254/latest/meta-data/",
      },
    });
  } catch (err: any) {
    if (err.message.includes("SSRF Protection")) {
      ssrfBlocked = true;
    }
  }
  assert(ssrfBlocked, "Chống SSRF: Từ chối URL Webhook không thuộc discord.com");

  // --- PHẦN 6: DỌN DẸP COOKIES.TXT VÀ .GITIGNORE ---
  console.log("\n--- 6. Kiểm tra cookies.txt và .gitignore ---");
  const cookiesPath = path.join(__dirname, "../cookies.txt");
  assert(!fs.existsSync(cookiesPath), "File cookies.txt không còn tồn tại trong kho lưu trữ");

  const gitignoreContent = fs.readFileSync(path.join(__dirname, "../.gitignore"), "utf-8");
  assert(gitignoreContent.includes("cookies.txt"), ".gitignore đã được bổ sung dòng cookies.txt");

  console.log("\n==================================================================");
  console.log(`📊 TỔNG KẾT: ${passCount} PASSED | ${failCount} FAILED`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test crash:", err);
  process.exit(1);
});
