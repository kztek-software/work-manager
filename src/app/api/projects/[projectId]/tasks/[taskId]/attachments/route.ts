import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { findOversizedFileError } from "@/lib/upload-limits";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function getFileType(mimeType: string, extension: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(extension)) {
    return "image";
  }
  if (mimeType.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(extension)) {
    return "video";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text") ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|log|csv|json|zip|rar|7z)$/i.test(extension)
  ) {
    return "document";
  }
  return "other";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const user = await requireUser();
  const { projectId, taskId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    include: {
      uploader: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ attachments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, taskId } = await params;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

    const contentType = req.headers.get("content-type") || "";

    // 1. Direct FormData Upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("file") as File[];

      if (!files || files.length === 0) {
        return NextResponse.json({ error: "Không tìm thấy file để upload" }, { status: 400 });
      }

      // Giới hạn dung lượng: mỗi tệp phải nhỏ hơn 50MB
      const oversizedError = findOversizedFileError(files.filter((f): f is File => f instanceof File));
      if (oversizedError) {
        return NextResponse.json({ error: oversizedError }, { status: 400 });
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const createdAttachments = [];

      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue;

        const originalName = file.name || "attachment";
        const ext = path.extname(originalName).toLowerCase();
        const randomSuffix = crypto.randomBytes(8).toString("hex");
        const sanitizedBaseName = path
          .basename(originalName, ext)
          .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
          .slice(0, 50);

        const savedFileName = `${Date.now()}-${randomSuffix}-${sanitizedBaseName}${ext}`;
        const filePath = path.join(UPLOAD_DIR, savedFileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        const fileType = getFileType(file.type || "", ext);
        const fileUrl = `/uploads/${savedFileName}`;

        const attachment = await prisma.attachment.create({
          data: {
            taskId,
            uploaderId: user.id,
            fileName: originalName,
            fileUrl,
            fileType,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
          },
          include: {
            uploader: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        createdAttachments.push(attachment);
      }

      if (createdAttachments.length > 0) {
        await prisma.activity.create({
          data: {
            taskId,
            actorId: user.id,
            action: "UPDATED",
            detail: `đã đính kèm ${createdAttachments.length} tệp/ảnh/video lỗi`,
          },
        });

        publish(projectId, { type: "TASK_CHANGED", taskId, actorId: user.id });
      }

      return NextResponse.json({ attachments: createdAttachments }, { status: 201 });
    }

    // 2. JSON Payload (nếu đã upload trước hoặc đính kèm qua link)
    const body = await req.json().catch(() => null);
    if (!body || !body.fileName || !body.fileUrl) {
      return NextResponse.json({ error: "Thiếu thông tin fileName hoặc fileUrl" }, { status: 400 });
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploaderId: user.id,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileType: body.fileType || "document",
        fileSize: body.fileSize || null,
        mimeType: body.mimeType || null,
      },
      include: {
        uploader: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    await prisma.activity.create({
      data: {
        taskId,
        actorId: user.id,
        action: "UPDATED",
        detail: `đã đính kèm tệp ${body.fileName}`,
      },
    });

    publish(projectId, { type: "TASK_CHANGED", taskId, actorId: user.id });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("Lỗi khi đính kèm file vào task:", error);
    return NextResponse.json({ error: "Không thể lưu tệp đính kèm" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, taskId } = await params;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json({ error: "Thiếu attachmentId" }, { status: 400 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.taskId !== taskId) {
      return NextResponse.json({ error: "Không tìm thấy tệp đính kèm" }, { status: 404 });
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Optionally try to delete file from disk if local
    if (attachment.fileUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
      fs.unlink(filePath).catch(() => {});
    }

    await prisma.activity.create({
      data: {
        taskId,
        actorId: user.id,
        action: "UPDATED",
        detail: `đã xóa tệp đính kèm ${attachment.fileName}`,
      },
    });

    publish(projectId, { type: "TASK_CHANGED", taskId, actorId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lỗi khi xóa attachment:", error);
    return NextResponse.json({ error: "Không thể xóa tệp" }, { status: 500 });
  }
}
