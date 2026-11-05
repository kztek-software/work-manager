import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getMaskedSystemConfigAsync, updateSystemConfigAsync } from "@/lib/system-config";
import { getSettingsAccess } from "@/lib/settings-access";
import { PERMISSION_CATEGORIES, SETTINGS_SECTION_PERMISSIONS, SETTINGS_SECTIONS } from "@/lib/permissions";

function permissionName(key: string): string {
  for (const cat of PERMISSION_CATEGORIES) {
    const found = cat.permissions.find((p) => p.key === key);
    if (found) return found.name;
  }
  return key;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Phân quyền theo ma trận (nhóm "Cấu hình & Cài đặt Hệ thống"), xét theo vai trò hệ thống
    const access = await getSettingsAccess(user);
    if (!access.canView) {
      return NextResponse.json(
        { error: "Truy cập bị từ chối. Bạn chưa được cấp quyền xem Cấu hình & Cài đặt hệ thống." },
        { status: 403 }
      );
    }

    // Khóa bí mật luôn được che (getMaskedSystemConfigAsync) kể cả với người có quyền sửa
    const config = await getMaskedSystemConfigAsync();
    return NextResponse.json({ config, access, currentUserRole: user.role });
  } catch (error) {
    console.error("Lỗi khi tải cấu hình hệ thống:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy cấu hình" }, { status: 500 });
  }
}

const updateConfigSchema = z.object({
  smtp: z
    .object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
      secure: z.boolean().optional(),
      from: z.string().optional(),
      fromName: z.string().optional(),
    })
    .optional(),
  branding: z
    .object({
      systemName: z.string().optional(),
      companyName: z.string().optional(),
      hotline: z.string().optional(),
      supportEmail: z.string().optional(),
      website: z.string().optional(),
      appUrl: z.string().optional(),
    })
    .optional(),
  notifications: z
    .object({
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
      enableRealtimeSse: z.boolean().optional(),
    })
    .optional(),
  zalo: z
    .object({
      enabled: z.boolean().optional(),
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      oaId: z.string().optional(),
      oaSecretKey: z.string().optional(),
      znsTemplateId: z.string().optional(),
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
    })
    .optional(),
  discord: z
    .object({
      enabled: z.boolean().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      botToken: z.string().optional(),
      webhookUrl: z
        .string()
        .optional()
        .refine(
          (url) => {
            if (!url || !url.trim()) return true;
            if (url === "******" || url.startsWith("••••")) return true;
            return (
              url.startsWith("https://discord.com/api/webhooks/") ||
              url.startsWith("https://discordapp.com/api/webhooks/")
            );
          },
          {
            message:
              "discordWebhookUrl chỉ cho phép URL webhook hợp lệ bắt đầu bằng https://discord.com/api/webhooks/ hoặc https://discordapp.com/api/webhooks/",
          }
        ),
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
      webhookOnAssign: z.boolean().optional(),
      webhookOnStatusChange: z.boolean().optional(),
      webhookOnComment: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const parsed = updateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu cấu hình không hợp lệ", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Mỗi nhóm cấu hình gửi lên phải có quyền sửa tương ứng (ma trận phân quyền)
    const access = await getSettingsAccess(user);
    const submitted = SETTINGS_SECTIONS.filter((section) => parsed.data[section] !== undefined);
    if (submitted.length === 0) {
      return NextResponse.json({ error: "Không có nhóm cấu hình nào để lưu" }, { status: 400 });
    }
    const denied = submitted.filter((section) => !access.canEdit[section]);
    if (denied.length > 0) {
      return NextResponse.json(
        {
          error: `Truy cập bị từ chối. Bạn chưa được cấp quyền: ${denied
            .map((section) => permissionName(SETTINGS_SECTION_PERMISSIONS[section]))
            .join(", ")}.`,
        },
        { status: 403 }
      );
    }

    await updateSystemConfigAsync(parsed.data, user.name);
    const maskedConfig = await getMaskedSystemConfigAsync();

    return NextResponse.json({
      success: true,
      message: "Cập nhật cấu hình hệ thống thành công",
      config: maskedConfig,
    });
  } catch (error: any) {
    console.error("  ❌ Lỗi khi lưu cấu hình hệ thống:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi lưu cấu hình" },
      { status: 400 }
    );
  }
}
