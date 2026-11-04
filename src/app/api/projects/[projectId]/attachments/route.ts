import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { checkUserPermission } from "@/lib/permissions-server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { findOversizedFileError } from "@/lib/upload-limits";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");


function getFileType(mimeType: string, extension: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(extension)) {
    return "image";
  }
  if (mimeType.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v)$/i.test(extension)) {
    return "video";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text") ||
    mimeType.includes("zip") ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|log|csv|json|zip|rar|7z)$/i.test(extension)
  ) {
    return "document";
  }
  return "other";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền truy cập dự án này" }, { status: 403 });
    }

    const attachments = await prisma.attachment.findMany({
      where: { projectId },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/attachments error:", error);
    return NextResponse.json({ error: "Lỗi tải danh sách tài liệu dự án" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền thao tác trên dự án này" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // 1. Direct FormData Upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = [
        ...(formData.getAll("files") as File[]),
        ...(formData.getAll("file") as File[]),
        ...(formData.getAll("attachments") as File[]),
      ];

      if (!files || files.length === 0) {
        return NextResponse.json({ error: "Không tìm thấy file để tải lên" }, { status: 400 });
      }

      // Giới hạn dung lượng: mỗi tệp phải nhỏ hơn 50MB (kiểm tra trước khi ghi bất kỳ tệp nào)
      const oversizedError = findOversizedFileError(files.filter((f): f is File => f instanceof File));
      if (oversizedError) {
        return NextResponse.json({ error: oversizedError }, { status: 400 });
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const createdAttachments = [];

      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue;

        const originalName = file.name || "project-document";
        const ext = path.extname(originalName).toLowerCase();
        const fileType = getFileType(file.type || "", ext);

        const randomSuffix = crypto.randomBytes(8).toString("hex");
        const sanitizedBaseName = path
          .basename(originalName, ext)
          .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
          .slice(0, 50);

        const savedFileName = `${Date.now()}-${randomSuffix}-${sanitizedBaseName}${ext}`;
        const filePath = path.join(UPLOAD_DIR, savedFileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        const fileUrl = `/uploads/${savedFileName}`;

        const attachment = await prisma.attachment.create({
          data: {
            projectId,
            uploaderId: user.id,
            fileName: originalName,
            fileUrl,
            fileType,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
          },
          include: {
            uploader: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
          },
        });

        createdAttachments.push(attachment);
      }

      return NextResponse.json({ attachments: createdAttachments }, { status: 201 });
    }

    // 2. JSON Payload (nếu đã upload trước hoặc truyền metadata)
    const body = await req.json().catch(() => null);
    if (!body || !body.fileName || !body.fileUrl) {
      return NextResponse.json({ error: "Thiếu thông tin fileName hoặc fileUrl" }, { status: 400 });
    }

    const attachment = await prisma.attachment.create({
      data: {
        projectId,
        uploaderId: user.id,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileType: body.fileType || "document",
        fileSize: body.fileSize || null,
        mimeType: body.mimeType || null,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("Lỗi khi đính kèm tài liệu vào dự án:", error);
    return NextResponse.json({ error: "Không thể lưu tài liệu đính kèm" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền thao tác trên dự án này" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json({ error: "Thiếu attachmentId" }, { status: 400 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.projectId !== projectId) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu đính kèm" }, { status: 404 });
    }

    // Chỉ uploader hoặc OWNER/ADMIN mới được xóa
    const isOwnerOrAdmin = user.role === "ADMIN" || member?.role === "OWNER" || member?.role === "ADMIN";
    const isUploader = attachment.uploaderId === user.id;

    if (!isOwnerOrAdmin && !isUploader) {
      return NextResponse.json({ error: "Bạn chỉ có thể xóa tài liệu do chính mình tải lên" }, { status: 403 });
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Clean up local file from disk if in /uploads/
    if (attachment.fileUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
      fs.unlink(filePath).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Đã xóa tài liệu đính kèm" });
  } catch (error) {
    console.error("Lỗi khi xóa attachment dự án:", error);
    return NextResponse.json({ error: "Không thể xóa tài liệu" }, { status: 500 });
  }
}
