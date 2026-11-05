import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword, createSession, getSessionUser, createJwtToken } from "../src/lib/auth";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { POST as changePasswordPost } from "../src/app/api/auth/change-password/route";
import { GET as usersGet, POST as usersPost } from "../src/app/api/users/route";
import { PATCH as userPatch, DELETE as userDelete } from "../src/app/api/users/[userId]/route";
import { DELETE as attachmentDelete } from "../src/app/api/attachments/[id]/route";
import { GET as ticketGet } from "../src/app/api/tickets/[ticketId]/route";
import { POST as ticketCommentPost } from "../src/app/api/tickets/[ticketId]/comments/route";
import { GET as emailLogsGet } from "../src/app/api/notifications/email-logs/route";
import { NextRequest } from "next/server";

function createReq(url: string, options: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ STEP 1.1 ===");

  // 1. Kiểm tra Model User & tokenVersion trong DB
  const admin = await prisma.user.findUnique({ where: { email: "admin@kztek.net" } });
  if (!admin || typeof admin.tokenVersion !== "number") {
    throw new Error("User admin hoặc tokenVersion không tồn tại trong DB!");
  }
  console.log(`[PASS] 1. Model User có tokenVersion = ${admin.tokenVersion}, isActive = ${admin.isActive}`);

  // 2. Kiểm tra scrypt async
  const hashed = await hashPassword("TestScrypt@2026");
  const isCorrect = await verifyPassword("TestScrypt@2026", hashed);
  const isWrong = await verifyPassword("WrongPassword", hashed);
  if (!isCorrect || isWrong) throw new Error("scrypt async verification thất bại!");
  console.log("[PASS] 2. scrypt async hash & verify hoạt động chuẩn xác");

  // 3. Đóng đăng ký công khai
  const regReq = createReq("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: { name: "Hacker", email: "hacker@test.com", password: "password123" },
  });
  const regRes = await registerPost(regReq);
  if (regRes.status !== 403) throw new Error(`Register không trả về 403, nhận: ${regRes.status}`);
  console.log("[PASS] 3. POST /api/auth/register trả về 403 Forbidden");

  // 4. Kiểm tra User ẩn danh gọi API Users & Email logs nhận 401
  const anonUsersReq = createReq("http://localhost:3000/api/users");
  const anonUsersRes = await usersGet(anonUsersReq, {} as any);
  if (anonUsersRes.status !== 401) throw new Error(`GET /api/users ẩn danh không trả 401, nhận: ${anonUsersRes.status}`);

  const anonLogsReq = createReq("http://localhost:3000/api/notifications/email-logs");
  const anonLogsRes = await emailLogsGet(anonLogsReq, {} as any);
  if (anonLogsRes.status !== 401) throw new Error(`GET email-logs ẩn danh không trả 401, nhận: ${anonLogsRes.status}`);

  const anonAttReq = createReq("http://localhost:3000/api/attachments/non-existent-id", { method: "DELETE" });
  const anonAttRes = await attachmentDelete(anonAttReq, { params: Promise.resolve({ id: "non-existent-id" }) });
  if (anonAttRes.status !== 401) throw new Error(`DELETE attachments ẩn danh không trả 401, nhận: ${anonAttRes.status}`);
  console.log("[PASS] 4. User ẩn danh bị chặn 401 ở /api/users, /email-logs, /attachments/[id]");

  // 5. Kiểm tra phân quyền RBAC: Member bình thường gọi /api/users nhận 403
  const member = await prisma.user.findFirst({ where: { role: "MEMBER" } });
  if (member) {
    const memberToken = await createJwtToken(member.id, { role: member.role, tokenVersion: member.tokenVersion });
    const memberUsersReq = createReq("http://localhost:3000/api/users", { token: memberToken });
    const memberUsersRes = await usersGet(memberUsersReq, {} as any);
    if (memberUsersRes.status !== 403) throw new Error(`Member gọi GET /api/users không bị 403, nhận: ${memberUsersRes.status}`);

    const memberLogsReq = createReq("http://localhost:3000/api/notifications/email-logs", { token: memberToken });
    const memberLogsRes = await emailLogsGet(memberLogsReq, {} as any);
    if (memberLogsRes.status !== 403) throw new Error(`Member gọi GET email-logs không bị 403, nhận: ${memberLogsRes.status}`);
    console.log("[PASS] 5. Member bị chặn 403 khi gọi API quản trị của ADMIN");
  }

  // 6. Kiểm tra ẩn danh gọi Ticket: internalNotes bị giấu, comment không gắn được isStaff
  // Tạo ticket mẫu để test
  const testTicket = await prisma.customerTicket.create({
    data: {
      trackingCode: `TEST-${Date.now()}`,
      title: "Test Ticket Security",
      description: "Description",
      customerName: "Khách Hàng Test",
      customerEmail: "customer@test.com",
      internalNotes: "BÍ MẬT NỘI BỘ KHÔNG ĐƯỢC LỘ",
    },
  });

  const ticketReq = createReq(`http://localhost:3000/api/tickets/${testTicket.id}`);
  const ticketRes = await ticketGet(ticketReq, { params: Promise.resolve({ ticketId: testTicket.id }) });
  const ticketData = await ticketRes.json();
  if (ticketData.ticket.internalNotes) {
    throw new Error("LỖI BẢO MẬT: User ẩn danh vẫn xem được internalNotes!");
  }
  console.log("[PASS] 6.1. internalNotes được che giấu hoàn toàn đối với user ẩn danh");

  // Test chặn gắn isStaff: true cho anonymous comment
  const commentReq = createReq(`http://localhost:3000/api/tickets/${testTicket.id}/comments`, {
    method: "POST",
    body: {
      authorName: "Kẻ mạo danh",
      authorEmail: "fake@kztek.net",
      message: "Tôi là nhân viên KZTEK",
      isStaff: true,
      isInternalOnly: true,
    },
  });
  const commentRes = await ticketCommentPost(commentReq, { params: Promise.resolve({ ticketId: testTicket.id }) });
  const commentData = await commentRes.json();
  if (commentData.comment.isStaff === true || commentData.comment.isInternalOnly === true) {
    throw new Error("LỖI BẢO MẬT: Khách hàng vẫn có thể tự phong isStaff: true hoặc isInternalOnly: true!");
  }
  console.log("[PASS] 6.2. Bình luận ẩn danh bị cưỡng chế isStaff=false và isInternalOnly=false");

  // Dọn dẹp ticket mẫu
  await prisma.customerTicket.delete({ where: { id: testTicket.id } });

  // 7. Kiểm tra thu hồi Token khi đổi mật khẩu (tokenVersion increment)
  const testUser = await prisma.user.create({
    data: {
      name: "Token Revoke Test User",
      email: `revoke-test-${Date.now()}@test.com`,
      passwordHash: await hashPassword("OldPassword@123"),
      mustChangePassword: true,
      tokenVersion: 1,
    },
  });

  // Tạo token cũ với tokenVersion 1
  const oldToken = await createJwtToken(testUser.id, { role: testUser.role, tokenVersion: 1 });
  const reqWithOldToken = createReq("http://localhost:3000/api/auth/change-password", {
    method: "POST",
    token: oldToken,
    body: { currentPassword: "OldPassword@123", newPassword: "NewPassword@456" },
  });

  const changeRes = await changePasswordPost(reqWithOldToken, {} as any);
  if (changeRes.status !== 200) throw new Error(`Đổi mật khẩu thất bại: ${changeRes.status}`);

  // Thử dùng oldToken lại
  const checkOldReq = createReq("http://localhost:3000/api/users", { token: oldToken });
  const sessionWithOldToken = await getSessionUser(checkOldReq);
  if (sessionWithOldToken !== null) {
    throw new Error("LỖI BẢO MẬT: Token cũ vẫn dùng được sau khi đổi mật khẩu!");
  }
  console.log("[PASS] 7. Token cũ bị vô hiệu hóa ngay lập tức sau khi đổi mật khẩu (tokenVersion tăng)");

  // Dọn dẹp user mẫu
  await prisma.user.delete({ where: { id: testUser.id } });

  console.log("\n==================================================");
  console.log("  TẤT CẢ 7/7 TIÊU CHÍ STEP 1.1 ĐÃ PASS HOÀN TOÀN! ✅");
  console.log("==================================================");
  await prisma.$disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
