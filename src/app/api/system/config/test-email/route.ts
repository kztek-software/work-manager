import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { sendTestEmail } from "@/lib/mail";
import { getSettingsAccess } from "@/lib/settings-access";

const testEmailSchema = z.object({
  recipientEmail: z.string().email("Địa chỉ email không hợp lệ"),
  recipientName: z.string().max(120).optional(),
});

/**
 * Gửi email thử nghiệm từ trang Cấu hình & Cài đặt — yêu cầu quyền "Cấu hình Email & SMTP" (email.config).
 * Tách khỏi /api/notifications/email-logs (proxy chỉ cho ADMIN) để quyền được cấp qua ma trận phân quyền.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (!(await getSettingsAccess(user)).canEdit.smtp) {
    return NextResponse.json({ error: "Bạn chưa được cấp quyền Cấu hình Email & SMTP để gửi thử" }, { status: 403 });
  }

  const parsed = testEmailSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const { recipientEmail, recipientName } = parsed.data;
  try {
    const log = await sendTestEmail(recipientEmail, recipientName?.trim() || user.name || "Người dùng KZTEK");
    return NextResponse.json({ success: true, message: `Đã gửi email thử nghiệm đến ${recipientEmail}`, log });
  } catch (error) {
    console.error("Lỗi khi gửi email test:", error);
    return NextResponse.json({ error: "Không thể gửi email thử nghiệm" }, { status: 500 });
  }
}
