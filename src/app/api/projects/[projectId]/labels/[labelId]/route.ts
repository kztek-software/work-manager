import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const updateLabelSchema = z.object({
  name: z.string().min(1, "Tên nhãn không được để trống").max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Mã màu hex không hợp lệ").optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; labelId: string }> }
) {
  const user = await requireUser(req);
  const { projectId, labelId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền sửa nhãn" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const label = await prisma.label.findUnique({
    where: { id: labelId },
  });
  if (!label || label.projectId !== projectId) {
    return NextResponse.json({ error: "Không tìm thấy nhãn" }, { status: 404 });
  }

  const updated = await prisma.label.update({
    where: { id: labelId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; labelId: string }> }
) {
  const user = await requireUser(req);
  const { projectId, labelId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền xóa nhãn" }, { status: 403 });
  }

  const label = await prisma.label.findUnique({
    where: { id: labelId },
  });
  if (!label || label.projectId !== projectId) {
    return NextResponse.json({ error: "Không tìm thấy nhãn" }, { status: 404 });
  }

  // Xóa các liên kết TaskLabel trước khi xóa nhãn
  await prisma.taskLabel.deleteMany({
    where: { labelId },
  });

  await prisma.label.delete({
    where: { id: labelId },
  });

  return NextResponse.json({ success: true });
}
