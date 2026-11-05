import { NextRequest, NextResponse } from "next/server";
import { verifyZaloWebhookSignature } from "@/lib/zalo/client";
import { consumeZaloLinkCode } from "@/lib/zalo/link";
import { getEffectiveZaloConfig } from "@/lib/system-config";
import crypto from "node:crypto";

/**
 * Webhook tiếp nhận sự kiện từ Zalo Official Account (user follow/unfollow, gửi tin nhắn...).
 * Bắt buộc kiểm tra tính hợp lệ của chữ ký hoặc mã bí mật (G0-4).
 */
export async function POST(req: NextRequest) {
  const cfg = getEffectiveZaloConfig();
  const configuredSecret = cfg.oaSecretKey || process.env.ZALO_WEBHOOK_SECRET;

  // 1. Kiểm tra cấu hình bảo vệ: nếu hệ thống chưa cấu hình secret -> từ chối 403
  if (!configuredSecret) {
    console.warn("[Zalo Webhook] Webhook bị gọi nhưng hệ thống chưa cấu hình oaSecretKey hoặc ZALO_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Zalo Webhook chưa được kích hoạt hoặc chưa cấu hình secret key" },
      { status: 403 }
    );
  }

  const rawBody = await req.text();

  let body: {
    app_id?: string;
    oa_id?: string;
    event_name?: string;
    timestamp?: string;
    sender?: { id?: string };
    follower?: { id?: string };
    message?: { text?: string; msg_id?: string };
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  // 2. Xác thực tính hợp lệ của request
  let isAuthorized = false;

  // Cách A: Header x-webhook-secret hoặc query param token/secret
  const customSecret =
    req.headers.get("x-webhook-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    req.nextUrl.searchParams.get("token");

  if (customSecret) {
    try {
      const matchEnv = process.env.ZALO_WEBHOOK_SECRET &&
        crypto.timingSafeEqual(Buffer.from(customSecret), Buffer.from(process.env.ZALO_WEBHOOK_SECRET));
      const matchOa = cfg.oaSecretKey &&
        crypto.timingSafeEqual(Buffer.from(customSecret), Buffer.from(cfg.oaSecretKey));
      if (matchEnv || matchOa) {
        isAuthorized = true;
      }
    } catch {
      // Buffer length mismatch
      isAuthorized = false;
    }
  }

  // Cách B: Chữ ký chính thức Zalo OA Webhook (header x-zevent-signature)
  if (!isAuthorized && cfg.oaSecretKey) {
    const signatureHeader = req.headers.get("x-zevent-signature");
    if (signatureHeader) {
      isAuthorized = verifyZaloWebhookSignature({
        rawBody,
        appId: body.app_id || cfg.appId,
        timestamp: body.timestamp || "",
        oaSecretKey: cfg.oaSecretKey,
        signatureHeader,
      });
    }
  }

  if (!isAuthorized) {
    console.warn("[Zalo Webhook] Chữ ký hoặc mã bí mật không hợp lệ — từ chối xử lý");
    return NextResponse.json({ error: "Invalid signature or secret key" }, { status: 401 });
  }

  const senderId = body.sender?.id || body.follower?.id;

  try {
    switch (body.event_name) {
      case "user_send_text": {
        const text = body.message?.text;
        if (text && senderId) {
          const linkedUserId = await consumeZaloLinkCode(text, senderId);
          if (linkedUserId) {
            console.log(`[Zalo Webhook] Đã liên kết Zalo ${senderId} với user ${linkedUserId} qua mã xác nhận`);
          }
        }
        break;
      }
      case "follow":
        console.log(`[Zalo Webhook] User ${senderId} vừa follow OA`);
        break;
      case "unfollow":
        console.log(`[Zalo Webhook] User ${senderId} vừa unfollow OA`);
        break;
      default:
        console.log(`[Zalo Webhook] Nhận event chưa xử lý: ${body.event_name}`);
    }
  } catch (error) {
    console.error("[Zalo Webhook] Lỗi khi xử lý event:", error);
  }

  return NextResponse.json({ ok: true });
}
