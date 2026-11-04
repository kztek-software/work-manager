import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
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

export async function POST(req: NextRequest) {
  try {
    // Optional user: allow public customers to upload error evidence without logging in
    const user = await getSessionUser();

    const formData = await req.formData();
    
    // Support both "files", "file" and "attachments" keys in FormData
    const files = [
      ...(formData.getAll("files") as File[]),
      ...(formData.getAll("file") as File[]),
      ...(formData.getAll("attachments") as File[]),
    ];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy tệp để tải lên" }, { status: 400 });
    }

    // Giới hạn dung lượng: mỗi tệp phải nhỏ hơn 50MB (kiểm tra trước khi ghi bất kỳ tệp nào)
    const oversizedError = findOversizedFileError(files.filter((f): f is File => f instanceof File));
    if (oversizedError) {
      return NextResponse.json({ error: oversizedError }, { status: 400 });
    }

    // Ensure uploads directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const uploadedResults = [];

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      const originalName = file.name || "upload";
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

      uploadedResults.push({
        fileName: originalName,
        savedFileName,
        fileUrl,
        fileType,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedBy: user ? user.name : "Khách hàng (Portal)",
      });
    }

    if (uploadedResults.length === 0) {
      return NextResponse.json({ error: "Không có tệp hợp lệ nào được tải lên" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      files: uploadedResults,
    });
  } catch (error) {
    console.error("Lỗi khi upload file:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải lên tệp" }, { status: 500 });
  }
}
