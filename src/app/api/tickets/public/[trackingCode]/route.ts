import { NextRequest, NextResponse } from "next/server";
import { getTicketByTrackingCode, toPublicTicketDto } from "@/lib/tickets";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/tickets/public/[trackingCode] -> Khách hàng tra cứu ticket bằng mã tra cứu (không cần đăng nhập).
// Chỉ trả dữ liệu công khai: không có dự án nội bộ, ghi chú nội bộ hay bình luận nội bộ.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingCode: string }> }
) {
  try {
    // Chống dò mã tra cứu: 30 lượt tra cứu / phút / IP
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`ticket_lookup:${clientIp}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse("Bạn tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút.", rl);
    }

    const { trackingCode } = await params;
    const ticket = await getTicketByTrackingCode(decodeURIComponent(trackingCode).trim().toUpperCase());
    if (!ticket) {
      // Mã sai: tối đa 10 lần / 10 phút / IP (người dò mã gần như chỉ toàn mã sai)
      const missRl = checkRateLimit(`ticket_lookup_miss:${clientIp}`, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
      if (!missRl.success) {
        return createRateLimitResponse("Bạn đã nhập sai mã tra cứu quá nhiều lần. Vui lòng thử lại sau 10 phút.", missRl);
      }
      return NextResponse.json({ error: "Không tìm thấy ticket với mã tra cứu này" }, { status: 404 });
    }

    return NextResponse.json({ ticket: toPublicTicketDto(ticket) });
  } catch (error) {
    console.error("Lỗi khi tra cứu ticket:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
