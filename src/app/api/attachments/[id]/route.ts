import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;

    // Kiểm tra tệp đính kèm tồn tại
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Không tìm thấy tệp đính kèm" }, { status: 404 });
    }

    // Kiểm tra quyền xóa: ADMIN | Người tải lên (uploader) | Quản lý dự án (OWNER / MANAGER)
    let canDelete = false;

    if (user.role === "ADMIN") {
      canDelete = true;
    } else if (attachment.uploaderId && attachment.uploaderId === user.id) {
      canDelete = true;
    } else if (attachment.projectId) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: attachment.projectId,
            userId: user.id,
          },
        },
      });
      if (membership && (membership.role === "OWNER" || membership.role === "MANAGER")) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa tệp đính kèm này" },
        { status: 403 }
      );
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
