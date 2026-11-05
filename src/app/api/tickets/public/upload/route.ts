import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { handleFileUpload } from "@/lib/upload-handler";

// POST /api/tickets/public/upload -> Khách hàng (portal, không đăng nhập) tải ảnh/video/tài liệu minh họa lỗi.
// Cùng các lớp bảo vệ với /api/upload, nhưng rate limit chặt hơn và giới hạn số tệp mỗi lần.
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`upload_public:${clientIp}`, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse("Bạn đã tải lên quá nhiều tệp trong thời gian ngắn. Vui lòng thử lại sau ít phút.", rl);
    }

    const formData = await req.formData();
    return await handleFileUpload(formData, { uploadedBy: "Khách hàng (Portal)", maxFiles: 10 });
  } catch (error) {
    console.error("Lỗi khi khách hàng upload file:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải lên tệp" }, { status: 500 });
  }
}
