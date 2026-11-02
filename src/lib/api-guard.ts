import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SessionUser } from "./auth";
import { hasPermission } from "./permissions-server";

export interface ApiAuthOptions {
  requiredRole?: string | string[];
  requiredPermission?: string;
  allowMustChangePassword?: boolean;
}

export type AuthenticatedApiHandler<TContext = any> = (
  req: NextRequest,
  context: TContext,
  user: SessionUser
) => Promise<Response | NextResponse> | Response | NextResponse;

/**
 * Higher-order Guard bảo vệ API Route tập trung.
 * Tự động kiểm tra phiên xác thực, tính toàn vẹn tokenVersion, trạng thái kích hoạt (isActive),
 * chặn cưỡng chế đổi mật khẩu (mustChangePassword), và kiểm tra phân quyền RBAC.
 */
export function withApiAuth<TContext = any>(
  handler: AuthenticatedApiHandler<TContext>,
  options: ApiAuthOptions = {}
) {
  return async (req: NextRequest, context: TContext) => {
    // 1. Kiểm tra session và tokenVersion hợp lệ từ DB
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Chưa đăng nhập hoặc phiên làm việc đã hết hạn" },
        { status: 401 }
      );
    }

    // 2. Kiểm tra trạng thái kích hoạt của tài khoản
    if (user.isActive === false) {
      return NextResponse.json(
        { error: "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // 3. Kiểm tra cờ mustChangePassword
    // Nếu user chưa đổi mật khẩu mặc định, chặn 403 với code PASSWORD_CHANGE_REQUIRED
    // ở mọi API trừ khi options.allowMustChangePassword === true (đổi mật khẩu, logout)
    if (user.mustChangePassword && !options.allowMustChangePassword) {
      return NextResponse.json(
        {
          error: "Vui lòng đổi mật khẩu khởi tạo trước khi tiếp tục thao tác",
          code: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 4. Kiểm tra requiredRole nếu có
    if (options.requiredRole) {
      const allowedRoles = Array.isArray(options.requiredRole)
        ? options.requiredRole
        : [options.requiredRole];
      const userRole = (user.role || "MEMBER").toUpperCase();
      const hasRole = allowedRoles.some((r) => r.toUpperCase() === userRole);
      if (!hasRole) {
        return NextResponse.json(
          {
            error: "Bạn không có quyền thực hiện thao tác này",
            code: "FORBIDDEN_ROLE",
          },
          { status: 403 }
        );
      }
    }

    // 5. Kiểm tra requiredPermission nếu có
    if (options.requiredPermission) {
      const permitted = await hasPermission(user.role, options.requiredPermission);
      if (!permitted) {
        return NextResponse.json(
          {
            error: "Bạn không đủ quyền hạn thực hiện thao tác này",
            code: "FORBIDDEN_PERMISSION",
          },
          { status: 403 }
        );
      }
    }

    // Thực thi handler với context và user đã qua guard
    return handler(req, context, user);
  };
}
