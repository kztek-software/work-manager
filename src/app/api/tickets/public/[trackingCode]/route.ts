import { NextRequest, NextResponse } from "next/server";
import { getTicketByTrackingCode, toPublicTicketDto } from "@/lib/tickets";

// GET /api/tickets/public/[trackingCode] -> Khách hàng tra cứu ticket bằng mã tra cứu (không cần đăng nhập).
// Chỉ trả dữ liệu công khai: không có dự án nội bộ, ghi chú nội bộ hay bình luận nội bộ.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackingCode: string }> }
) {
  try {
    const { trackingCode } = await params;
    const ticket = await getTicketByTrackingCode(decodeURIComponent(trackingCode).trim().toUpperCase());
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy ticket với mã tra cứu này" }, { status: 404 });
    }

    return NextResponse.json({ ticket: toPublicTicketDto(ticket) });
  } catch (error) {
    console.error("Lỗi khi tra cứu ticket:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
