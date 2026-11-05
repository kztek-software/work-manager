import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmailLogs, sendTestEmail, isSmtpConfigured, clearEmailLogs } from "@/lib/mail";
import { withApiAuth } from "@/lib/api-guard";

/**
 * Chỉ Quản trị viên (ADMIN) mới có quyền truy cập xem danh sách email logs
 */
export const GET = withApiAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const query = searchParams.get("q")?.toLowerCase() || "";
      const type = searchParams.get("type");
      const status = searchParams.get("status");

      let logs = getEmailLogs();

      if (query) {
        logs = logs.filter(
          (l) =>
            l.to.toLowerCase().includes(query) ||
            l.subject.toLowerCase().includes(query) ||
            (l.toName && l.toName.toLowerCase().includes(query))
        );
      }

      if (type && type !== "ALL") {
        logs = logs.filter((l) => l.type === type);
      }

      if (status && status !== "ALL") {
        logs = logs.filter((l) => l.status === status);
      }

      return NextResponse.json({
        logs,
        total: logs.length,
        smtpConfigured: isSmtpConfigured(),
        smtpHost: process.env.SMTP_HOST || "Local Simulated Outbox",
        fromEmail: process.env.SMTP_FROM || "no-reply@kztek.net",
      });
    } catch (error) {
      console.error("Lỗi khi lấy email logs:", error);
      return NextResponse.json({ error: "Lỗi máy chủ khi tải logs" }, { status: 500 });
    }
  },
  { requiredRole: "ADMIN" }
);

const testEmailSchema = z.object({
  recipientEmail: z.string().email("Địa chỉ email không hợp lệ"),
  recipientName: z.string().optional(),
});

/**
 * Chỉ Quản trị viên (ADMIN) mới có quyền bắn email kiểm thử
 */
export const POST = withApiAuth(
  async (req: NextRequest, _context, user) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = testEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
          { status: 400 }
        );
      }

      const { recipientEmail, recipientName } = parsed.data;
      const targetName = recipientName?.trim() || user.name || "Người dùng KZTEK";

      const logEntry = await sendTestEmail(recipientEmail, targetName);

      return NextResponse.json({
        success: true,
        message: `Đã gửi email thử nghiệm đến ${recipientEmail}`,
        log: logEntry,
      });
    } catch (error) {
      console.error("Lỗi khi gửi email test:", error);
      return NextResponse.json({ error: "Không thể gửi email thử nghiệm" }, { status: 500 });
    }
  },
  { requiredRole: "ADMIN" }
);

/**
 * Chỉ Quản trị viên (ADMIN) mới có quyền xóa toàn bộ lịch sử outbox
 */
export const DELETE = withApiAuth(
  async () => {
    try {
      clearEmailLogs();
      return NextResponse.json({ success: true, message: "Đã xóa toàn bộ lịch sử outbox" });
    } catch {
      return NextResponse.json({ error: "Lỗi khi xóa lịch sử" }, { status: 500 });
    }
  },
  { requiredRole: "ADMIN" }
);
