import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const createLabelSchema = z.object({
  name: z.string().min(1, "Tên nhãn không được để trống").max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Mã màu hex không hợp lệ").default("#6366f1"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser(_req);
  const { projectId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const labels = await prisma.label.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  return NextResponse.json(labels);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser(req);
  const { projectId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền tạo nhãn" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.label.findUnique({
    where: {
      projectId_name: {
        projectId,
        name: parsed.data.name.trim(),
      },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Nhãn này đã tồn tại trong dự án" }, { status: 400 });
  }

  const label = await prisma.label.create({
    data: {
      projectId,
      name: parsed.data.name.trim(),
      color: parsed.data.color,
    },
  });

  return NextResponse.json(label, { status: 201 });
}
