import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "flowboard-dev-secret-change-me-in-production"
);
const COOKIE_NAME = "flowboard_session";

/**
 * Proxy (Next.js 16 file convention thay thế middleware.ts).
 * Chặn sớm tại Gateway tầng Edge/Server các route quản trị hệ thống và API nhạy cảm.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lấy token từ header Authorization hoặc Cookie
  let token: string | undefined;
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  if (!token) {
    token = request.cookies.get(COOKIE_NAME)?.value;
  }

  // 1. Không có token -> 401 (API) hoặc chuyển hướng về /login (Giao diện)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const role = (payload.role as string | undefined)?.toUpperCase();

    // 2. Kiểm tra vai trò ADMIN đối với các route quản trị hệ thống
    if (role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Chỉ Quản trị viên (ADMIN) mới có quyền truy cập tài nguyên này" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/?error=forbidden", request.url));
    }

    return NextResponse.next();
  } catch {
    // Token không hợp lệ hoặc hết hạn
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Phiên làm việc không hợp lệ" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export default proxy;

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/users/:path*",
    "/api/users",
    "/api/notifications/email-logs/:path*",
    "/api/notifications/email-logs",
  ],
};
