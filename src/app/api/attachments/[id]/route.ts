import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { findAccessibleTicket, getTicketAccess, getTicketCapabilities } from "@/lib/ticket-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();

    // Check if attachment exists
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Không tìm thấy tệp đính kèm" }, { status: 404 });
    }

    // Tệp của ticket: kiểm tra phạm vi xem & quyền xử lý ticket
    if (attachment.ticketId) {
      if (!user) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      }
      const access = await getTicketAccess(user);
      const ticket = await findAccessibleTicket(access, attachment.ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Không tìm thấy tệp đính kèm" }, { status: 404 });
      }
      if (!getTicketCapabilities(access, ticket.projectId).canWrite) {
        return NextResponse.json({ error: "Bạn chỉ có quyền xem ticket này" }, { status: 403 });
      }
    }

    await prisma.attachment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã xóa tệp đính kèm" });
  } catch (error) {
    console.error("Lỗi xóa attachment:", error);
    return NextResponse.json({ error: "Không thể xóa tệp đính kèm" }, { status: 500 });
  }
}
