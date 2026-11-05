import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { withApiAuth } from "@/lib/api-guard";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const POST = withApiAuth(
  async (req: NextRequest, _context, currentUser) => {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự" }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true },
    });

    const isMatch = user ? await verifyPassword(currentPassword, user.passwordHash) : false;
    if (!user || !isMatch) {
      return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" }, { status: 400 });
    }

    // Tăng tokenVersion để lập tức thu hồi mọi session/JWT cũ và tắt mustChangePassword
    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
      select: { id: true, tokenVersion: true, role: true },
    });

    // Cấp phiên mới tương ứng với tokenVersion vừa cập nhật
    const newToken = await createSession(updated.id, updated.tokenVersion, updated.role);

    const res = NextResponse.json({ ok: true, token: newToken });
    res.cookies.set("flowboard_session", newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  },
  { allowMustChangePassword: true }
);
