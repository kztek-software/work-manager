import { NextRequest, NextResponse } from "next/server";

/**
 * Đóng tính năng tự đăng ký tài khoản công khai theo chính sách an ninh KZTEK (Phase G0).
 * Toàn bộ tài khoản phải do Quản trị viên (ADMIN) cấp phát qua API /api/users.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "Registration is closed",
      message: "Tính năng tự đăng ký tài khoản đã bị khóa. Vui lòng liên hệ Quản trị viên KZTEK để được cấp tài khoản.",
    },
    { status: 403 }
  );
}
