import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getSettingsAccess } from "@/lib/settings-access";
import { prisma } from "@/lib/prisma";
import { sendDiscordDM, sendDiscordWebhookEmbed, DiscordApiError } from "@/lib/discord/client";
import { getEffectiveDiscordConfig } from "@/lib/system-config";

const testSendSchema = z.object({
  channel: z.enum(["DM", "WEBHOOK"]),
  discordUserId: z.string().optional(),
});

/**
 * Gửi thử 1 tin nhắn Discord (DM hoặc Webhook kênh chung) để Admin kiểm tra kết nối đã đúng chưa.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (!(await getSettingsAccess(user)).canEdit.discord) {
    return NextResponse.json({ error: "Bạn chưa được cấp quyền Tích hợp Discord để gửi thử" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = testSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu gửi thử không hợp lệ" }, { status: 400 });
  }
  const { channel, discordUserId } = parsed.data;

  const cfg = getEffectiveDiscordConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "Chưa bật tích hợp Discord trong Cài đặt Hệ thống" }, { status: 400 });
  }

  const content = `**[KZTEK Work Management]** Đây là tin nhắn thử nghiệm kết nối Discord do ${user.name} gửi lúc ${new Date().toLocaleString("vi-VN")}.`;

  const log = await prisma.discordMessageLog.create({
    data: {
      userId: channel === "DM" ? user.id : null,
      discordUserId: channel === "DM" ? discordUserId : undefined,
      channel,
      notificationType: "TEST",
      content,
      status: "PENDING",
    },
  });

  try {
    if (channel === "DM") {
      if (!discordUserId) {
        return NextResponse.json({ error: "Thiếu Discord User ID để gửi thử qua DM" }, { status: 400 });
      }
      const result = await sendDiscordDM(discordUserId, content);
      await prisma.discordMessageLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), providerMsgId: result.messageId },
      });
    } else {
      await sendDiscordWebhookEmbed({
        title: "🧪 Tin Nhắn Thử Nghiệm",
        description: `Kết nối Discord Webhook đang hoạt động tốt! Gửi bởi **${user.name}** lúc ${new Date().toLocaleString("vi-VN")}.`,
        color: 0xcbcbcb,
        footer: { text: "KZTEK Work Management" },
        timestamp: new Date().toISOString(),
      });
      await prisma.discordMessageLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, message: "Gửi thử nghiệm thành công!" });
  } catch (error) {
    const message = error instanceof DiscordApiError ? error.message : "Lỗi không xác định khi gửi thử";
    await prisma.discordMessageLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
