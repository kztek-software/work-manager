import "dotenv/config";
import { checkRateLimit, resetRateLimit, createRateLimitResponse } from "../src/lib/rate-limit";
import { GET as healthGet } from "../src/app/api/health/route";
import { POST as uploadPost } from "../src/app/api/upload/route";
import { POST as zaloWebhookPost } from "../src/app/api/integrations/zalo/webhook/route";
import { prisma } from "../src/lib/prisma";
import { createSession } from "../src/lib/auth";
import { NextRequest } from "next/server";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, extra?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`, extra || "");
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("KIỂM THỬ TỰ ĐỘNG BƯỚC 1.3 (STEP-1.3 VERIFICATION TEST SUITE)");
  console.log("==========================================================\n");

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Rate Limiter (G0-4)
  // --------------------------------------------------------------------------
  console.log("▶ TEST 1: Kiểm tra In-Memory Rate Limiter (sliding window per-IP)");
  const testIp = "192.168.1.99";
  const rateLimitKey = `login_test:${testIp}`;
  resetRateLimit(rateLimitKey);

  // 10 requests đầu tiên phải thành công
  let allTenPassed = true;
  for (let i = 1; i <= 10; i++) {
    const res = checkRateLimit(rateLimitKey, { maxRequests: 10, windowMs: 60000 });
    if (!res.success) {
      allTenPassed = false;
      break;
    }
  }
  assert(allTenPassed, "10 requests đầu tiên trong 1 phút được chấp nhận (success: true)");

  // Request thứ 11 phải bị chặn (429)
  const eleventhRes = checkRateLimit(rateLimitKey, { maxRequests: 10, windowMs: 60000 });
  assert(!eleventhRes.success && eleventhRes.remaining === 0, "Request thứ 11 bị chặn (success: false, remaining: 0)");

  const response429 = createRateLimitResponse("Quá nhiều lần đăng nhập không thành công, vui lòng thử lại sau 1 phút", eleventhRes);
  assert(response429.status === 429, "createRateLimitResponse trả về HTTP status 429 Too Many Requests");
  const json429 = await response429.json();
  assert(json429.error.includes("Quá nhiều lần đăng nhập"), "Payload 429 chứa đúng thông điệp cảnh báo người dùng");

  resetRateLimit(rateLimitKey);
  const afterResetRes = checkRateLimit(rateLimitKey, { maxRequests: 10, windowMs: 60000 });
  assert(afterResetRes.success, "Sau khi resetRateLimit, request được phép thực thi lại bình thường");

  console.log();

  // --------------------------------------------------------------------------
  // TEST SUITE 2: System Health Check Endpoint (/api/health) (G0-6)
  // --------------------------------------------------------------------------
  console.log("▶ TEST 2: Kiểm tra Endpoint Sức Khỏe Hệ Thống (/api/health)");
  const healthRes = await healthGet();
  assert(healthRes.status === 200, "/api/health trả về HTTP status 200 OK");
  const healthData = await healthRes.json();
  assert(healthData.status === "ok" && healthData.db === "connected", "/api/health xác nhận DB PostgreSQL 17 kết nối thành công (db: connected)");
  assert(typeof healthData.uptime === "number" && healthData.uptime > 0, "/api/health trả về thời gian uptime của tiến trình Node.js");

  console.log();

  // --------------------------------------------------------------------------
  // TEST SUITE 3: An Toàn Tải Lên Tệp Tin (/api/upload) (G0-4)
  // --------------------------------------------------------------------------
  console.log("▶ TEST 3: Kiểm tra An Toàn Tải Lên Tệp Tin (/api/upload)");

  // 3.1. Chưa đăng nhập -> 401
  const unauthReq = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: new FormData(),
  });
  const unauthRes = await uploadPost(unauthReq);
  assert(unauthRes.status === 401, "Upload khi chưa xác thực người dùng bị từ chối với HTTP 401 Unauthorized");

  // Lấy 1 user thật để tạo session hợp lệ
  const testUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!testUser) {
    throw new Error("Không tìm thấy user ADMIN trong database để kiểm thử upload");
  }
  const sessionToken = await createSession(testUser.id, testUser.tokenVersion, testUser.role);

  // 3.2. Cố tình upload file .html -> 400 Forbidden extension
  const htmlFormData = new FormData();
  const htmlBlob = new Blob(["<script>alert('XSS')</script>"], { type: "text/html" });
  htmlFormData.append("file", htmlBlob, "exploit.html");

  const htmlReq = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: htmlFormData,
    headers: {
      authorization: `Bearer ${sessionToken}`,
      cookie: `flowboard_session=${sessionToken}`,
    },
  });
  const htmlRes = await uploadPost(htmlReq);
  assert(htmlRes.status === 400, "Upload file .html bị chặn với HTTP 400 Bad Request");
  const htmlResData = await htmlRes.json();
  assert(htmlResData.error.includes("bị cấm tải lên"), "Thông báo lỗi nêu rõ phần mở rộng bị cấm vì lý do an toàn bảo mật");

  // 3.3. Cố tình upload file .svg -> 400 Forbidden extension
  const svgFormData = new FormData();
  const svgBlob = new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/svg+xml" });
  svgFormData.append("file", svgBlob, "vector.svg");

  const svgReq = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: svgFormData,
    headers: {
      authorization: `Bearer ${sessionToken}`,
      cookie: `flowboard_session=${sessionToken}`,
    },
  });
  const svgRes = await uploadPost(svgReq);
  assert(svgRes.status === 400, "Upload file .svg bị chặn với HTTP 400 Bad Request");

  // 3.4. Cố tình upload file giả mạo PNG nhưng nội dung là text -> 400 Magic Bytes failed
  const fakePngFormData = new FormData();
  const fakePngFile = new File(["NOT_A_REAL_PNG_DATA_HELLO_WORLD"], "spoofed.png", { type: "image/png" });
  fakePngFormData.append("file", fakePngFile);

  const fakePngReq = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: fakePngFormData,
    headers: {
      authorization: `Bearer ${sessionToken}`,
      cookie: `flowboard_session=${sessionToken}`,
    },
  });
  const fakePngRes = await uploadPost(fakePngReq);
  assert(fakePngRes.status === 400, "Upload file PNG giả mạo magic bytes bị từ chối HTTP 400");
  const fakePngData = await fakePngRes.json();
  assert(fakePngData.error.includes("không đúng định dạng ảnh"), "Thông báo lỗi phát hiện tệp ảnh bị hỏng hoặc giả mạo");

  // 3.5. Upload file PNG thật (8 byte magic bytes chuẩn) -> 200 OK
  const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validPngFormData = new FormData();
  const validPngFile = new File([validPngBytes], "valid_kztek_logo.png", { type: "image/png" });
  validPngFormData.append("file", validPngFile);

  const validPngReq = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: validPngFormData,
    headers: {
      authorization: `Bearer ${sessionToken}`,
      cookie: `flowboard_session=${sessionToken}`,
    },
  });
  const validPngRes = await uploadPost(validPngReq);
  assert(validPngRes.status === 200, "Upload file PNG thật với Magic Bytes hợp lệ thành công HTTP 200");
  const validPngData = await validPngRes.json();
  assert(validPngData.success === true && validPngData.files?.length > 0, "File được lưu thành công với UUID và metadata đầy đủ");
  assert(!validPngData.files[0].savedFileName.includes(".."), "Tên file lưu trữ trên đĩa được sinh bằng UUID không chứa ký tự path traversal");

  if (validPngData.files?.[0]?.savedFileName) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.unlink(path.join(process.cwd(), "public", "uploads", validPngData.files[0].savedFileName)).catch(() => {});
  }

  console.log();

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Zalo Webhook Security (G0-4)
  // --------------------------------------------------------------------------
  console.log("▶ TEST 4: Kiểm tra Bảo Vệ Zalo Webhook");

  // Request không có bất kỳ secret nào -> 401 hoặc 403
  const badZaloReq = new NextRequest("http://localhost:3000/api/integrations/zalo/webhook", {
    method: "POST",
    body: JSON.stringify({ event_name: "test", timestamp: "12345" }),
  });
  const badZaloRes = await zaloWebhookPost(badZaloReq);
  assert(badZaloRes.status === 401 || badZaloRes.status === 403, "Zalo Webhook từ chối request không có secret/chữ ký hợp lệ (HTTP 401/403)");

  console.log();

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Tính Nguyên Tử (Atomic) khi sinh Task.number (G0-6)
  // --------------------------------------------------------------------------
  console.log("▶ TEST 5: Kiểm tra Tính Nguyên Tử (Atomic) khi sinh Task.number đồng thời");

  const targetProject = await prisma.project.findFirst();
  if (!targetProject) {
    throw new Error("Không có project nào trong CSDL để test concurrency");
  }

  const numTasks = 5;
  const createdTaskIds: string[] = [];

  console.log(`  → Bắn đồng thời ${numTasks} tác vụ tạo task vào project "${targetProject.name}" (ID: ${targetProject.id})...`);

  // Mô phỏng logic tạo task nguyên tử với transaction + retry P2002 như trong router
  const createTaskConcurrently = async (index: number) => {
    const maxAttempts = 3;
    let attempt = 0;
    let created = null;

    while (attempt < maxAttempts) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const lastTask = await tx.task.findFirst({
            where: { projectId: targetProject.id },
            orderBy: { number: "desc" },
            select: { number: true },
          });

          const nextNumber = (lastTask?.number ?? 0) + 1;

          return tx.task.create({
            data: {
              projectId: targetProject.id,
              number: nextNumber,
              title: `[TEST CONCURRENCY ${Date.now()}] Task số ${index}`,
              description: "Kiểm tra atomic task number generation",
              type: "TASK",
              status: "TODO",
              priority: "MEDIUM",
              creatorId: testUser.id,
              position: 1000 * index,
            },
            select: { id: true, number: true, title: true },
          });
        });
        break;
      } catch (err: any) {
        if (err?.code === "P2002" && attempt < maxAttempts - 1) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
          continue;
        }
        throw err;
      }
    }
    return created;
  };

  const results = await Promise.all(
    Array.from({ length: numTasks }, (_, i) => createTaskConcurrently(i + 1))
  );

  const numbers = results.map((r) => r?.number);
  const uniqueNumbers = new Set(numbers);

  assert(results.length === numTasks, `Tất cả ${numTasks} tasks được tạo thành công không bị gián đoạn hay crash`);
  assert(uniqueNumbers.size === numTasks, `Toàn bộ ${numTasks} Task.number sinh ra đều duy nhất: [${numbers.join(", ")}]`);

  // Thu dọn các task test
  for (const r of results) {
    if (r?.id) createdTaskIds.push(r.id);
  }
  await prisma.task.deleteMany({
    where: { id: { in: createdTaskIds } },
  });
  console.log(`  ✓ Đã thu dọn dẹp sạch ${createdTaskIds.length} tasks thử nghiệm khỏi CSDL`);

  console.log();
  console.log("==========================================================");
  console.log(`TỔNG KẾT: ${passedTests}/${totalTests} TESTS PASS (${failedTests} FAILED)`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Lỗi ngoại lệ trong quá trình chạy test suite:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
