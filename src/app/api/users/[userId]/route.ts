import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { withApiAuth } from "@/lib/api-guard";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).optional(),
  title: z.string().max(100).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  discordUserId: z.string().max(32).nullable().optional(),
});

/**
 * Chỉ Quản trị viên (ADMIN) mới có quyền cập nhật thông tin, trạng thái và phân quyền người dùng
 */
export const PATCH = withApiAuth<{ params: Promise<{ userId: string }> }>(
  async (req: NextRequest, { params }, currentUser) => {
    const { userId } = await params;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ" }, { status: 400 });
    }

    const { name, email, password, title, avatarColor, role, isActive, teamId, phone, discordUserId } = parsed.data;

    if (email && email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: "Email này đã tồn tại" }, { status: 400 });
      }
    }

    const updateData: {
      name?: string;
      email?: string;
      passwordHash?: string;
      mustChangePassword?: boolean;
      tokenVersion?: { increment: number };
      isActive?: boolean;
      title?: string | null;
      avatarColor?: string;
      role?: string;
      teamId?: string | null;
      phone?: string | null;
      discordUserId?: string | null;
      discordUsername?: string | null;
      discordLinkedAt?: Date | null;
    } = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      updateData.passwordHash = await hashPassword(password);
      // Admin đặt lại mật khẩu cho người khác -> buộc người đó đổi lại ở lần đăng nhập kế tiếp
      updateData.mustChangePassword = currentUser.id !== userId;
      // Thu hồi toàn bộ session/token cũ của user này
      updateData.tokenVersion = { increment: 1 };
    }
    if (title !== undefined) updateData.title = title;
    if (avatarColor) updateData.avatarColor = avatarColor;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (teamId !== undefined) updateData.teamId = teamId;
    if (phone !== undefined) updateData.phone = phone;

    if (discordUserId !== undefined) {
      if (discordUserId) {
        await prisma.user.updateMany({
          where: { discordUserId, id: { not: userId } },
          data: { discordUserId: null, discordUsername: null, discordLinkedAt: null },
        });
      }
      updateData.discordUserId = discordUserId;
      updateData.discordUsername = discordUserId ? target.discordUsername : null;
      updateData.discordLinkedAt = discordUserId ? new Date() : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        avatarColor: true,
        role: true,
        isActive: true,
        teamId: true,
        phone: true,
        zaloUserId: true,
        zaloLinkedAt: true,
        discordUserId: true,
        discordUsername: true,
        discordLinkedAt: true,
        team: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  },
  { requiredRole: "ADMIN" }
);

/**
 * Chỉ Quản trị viên (ADMIN) mới có quyền xóa người dùng
 */
export const DELETE = withApiAuth<{ params: Promise<{ userId: string }> }>(
  async (_req: NextRequest, { params }, currentUser) => {
    const { userId } = await params;

    if (currentUser.id === userId) {
      return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  },
  { requiredRole: "ADMIN" }
);
