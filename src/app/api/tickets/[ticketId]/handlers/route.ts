import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { findAccessibleTicket, getTicketAccess, ticketRouteError } from "@/lib/ticket-access";
import { getEligibleTicketHandlers } from "@/lib/ticket-workflow";

// GET /api/tickets/[ticketId]/handlers -> Người có thể được giao xử lý ticket
// (thành viên dự án của ticket có quyền xử lý ticket). Chỉ người điều phối dùng.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { ticketId } = await params;

    const access = await getTicketAccess(user);
    const row = await findAccessibleTicket(access, ticketId);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }
    if (!access.canAssign) {
      return NextResponse.json(
        { error: "Bạn không có quyền giao người xử lý (Yêu cầu quyền: tickets.assign)" },
        { status: 403 }
      );
    }
    if (!row.projectId) {
      return NextResponse.json({ handlers: [] });
    }

    return NextResponse.json({ handlers: await getEligibleTicketHandlers(row.projectId) });
  } catch (error) {
    return ticketRouteError(error, "Lỗi tải danh sách người xử lý ticket:");
  }
}
