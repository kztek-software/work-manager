import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { handleFileUpload } from "@/lib/upload-handler";

// POST /api/upload -> Nhân viên đã đăng nhập tải tệp lên (khách hàng portal dùng /api/tickets/public/upload)
export async function POST(req: NextRequest) {
  try {
    // 1. Kiểm tra Rate Limit: 20 requests / phút / IP
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`upload:${clientIp}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse("Bạn đã tải lên quá nhiều tệp trong thời gian ngắn. Vui lòng thử lại sau 1 phút.", rl);
    }

    // 2. Bắt buộc kiểm tra Authentication (G0-4)
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập để tải lên tệp tin" }, { status: 401 });
    }

    const formData = await req.formData();
    return await handleFileUpload(formData, { uploadedBy: user.name || user.email });
  } catch (error) {
    console.error("Lỗi khi upload file:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải lên tệp" }, { status: 500 });
  }
}
