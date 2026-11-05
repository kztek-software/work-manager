import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getSettingsAccess } from "@/lib/settings-access";
import { prisma } from "@/lib/prisma";
import { sendOaTextMessage, sendZnsTemplateMessage, ZaloApiError } from "@/lib/zalo/client";
import { getEffectiveZaloConfig } from "@/lib/system-config";

const testSendSchema = z.object({
  channel: z.enum(["OA", "ZNS"]),
  zaloUserId: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * Gửi thử 1 tin nhắn Zalo (OA hoặc ZNS) để Admin kiểm tra kết nối đã cấu hình đúng chưa,
 * tương tự nút "Gửi Thử Nghiệm Email" hiện có cho SMTP.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (!(await getSettingsAccess(user)).canEdit.zalo) {
    return NextResponse.json({ error: "Bạn chưa được cấp quyền Tích hợp Zalo để gửi thử" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = testSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu gửi thử không hợp lệ" }, { status: 400 });
  }
  const { channel, zaloUserId, phone } = parsed.data;

  const cfg = getEffectiveZaloConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "Chưa bật tích hợp Zalo trong Cài đặt Hệ thống" }, { status: 400 });
  }

  const content = `[KZTEK Work Management] Đây là tin nhắn thử nghiệm kết nối Zalo do ${user.name} gửi lúc ${new Date().toLocaleString("vi-VN")}.`;

  const log = await prisma.zaloMessageLog.create({
    data: {
      userId: user.id,
      zaloUserId: channel === "OA" ? zaloUserId : undefined,
      phone: channel === "ZNS" ? phone : undefined,
      channel,
      notificationType: "TEST",
      templateId: channel === "ZNS" ? cfg.znsTemplateId : undefined,
      content,
      status: "PENDING",
    },
  });

  try {
    if (channel === "OA") {
      if (!zaloUserId) {
        return NextResponse.json({ error: "Thiếu Zalo User ID để gửi thử qua OA" }, { status: 400 });
      }
      const result = await sendOaTextMessage(zaloUserId, content);
      await prisma.zaloMessageLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), providerMsgId: result.msgId },
      });
    } else {
      if (!phone || !cfg.znsTemplateId) {
        return NextResponse.json({ error: "Thiếu số điện thoại hoặc chưa cấu hình ZNS Template ID" }, { status: 400 });
      }
      const result = await sendZnsTemplateMessage({
        phone,
        templateId: cfg.znsTemplateId,
        templateData: { title: "Tin nhắn thử nghiệm", content },
        trackingId: log.id,
      });
      await prisma.zaloMessageLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), providerMsgId: result.msgId },
      });
    }

    return NextResponse.json({ success: true, message: "Gửi thử nghiệm thành công!" });
  } catch (error) {
    const message = error instanceof ZaloApiError ? error.message : "Lỗi không xác định khi gửi thử";
    await prisma.zaloMessageLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
