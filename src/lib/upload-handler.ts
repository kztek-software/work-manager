import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { findOversizedFileError } from "@/lib/upload-limits";

// Xử lý upload dùng chung cho /api/upload (nhân viên đã đăng nhập) và /api/tickets/public/upload (khách hàng portal).
// Giữ nguyên các lớp bảo vệ G0-4: cấm phần mở rộng nguy hiểm, kiểm tra magic bytes ảnh, tên tệp UUID, giới hạn < 50MB.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Định dạng URL tệp do handleFileUpload sinh ra: /uploads/<timestamp>-<uuid><ext> */
export const UPLOADED_FILE_URL_PATTERN =
  /^\/uploads\/\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;

// Danh sách các phần mở rộng cấm tuyệt đối vì rủi ro thực thi mã / XSS / injection
const FORBIDDEN_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".cjs",
  ".xhtml",
  ".xml",
  ".php",
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".vbs",
  ".dll",
  ".com",
  ".scr",
  ".msi",
  ".jsp",
  ".asp",
  ".aspx",
]);

function getFileType(mimeType: string, extension: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|ico)$/i.test(extension)) {
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

/**
 * Xác thực Magic Bytes cơ bản của các định dạng ảnh phổ biến để ngăn chặn file spoofing
 */
function validateImageMagicBytes(buffer: Buffer, mimeType: string, ext: string): boolean {
  if (buffer.length < 4) return false;

  // PNG: \x89PNG (89 50 4E 47)
  if (ext === ".png" || mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // JPEG / JPG: \xFF\xD8\xFF
  if (ext === ".jpg" || ext === ".jpeg" || mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  // GIF: GIF8 (47 49 46 38)
  if (ext === ".gif" || mimeType === "image/gif") {
    return (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (ext === ".webp" || mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  // Đối với các ảnh khác (bmp, ico), cho phép nếu không có chữ ký cấm
  return true;
}

export type UploadOptions = {
  uploadedBy: string;
  /** Số tệp tối đa mỗi lần gửi (mặc định không giới hạn) */
  maxFiles?: number;
};

export async function handleFileUpload(formData: FormData, options: UploadOptions): Promise<NextResponse> {
  // Hỗ trợ cả 3 key "files", "file" và "attachments" trong FormData
  const files = [
    ...(formData.getAll("files") as File[]),
    ...(formData.getAll("file") as File[]),
    ...(formData.getAll("attachments") as File[]),
  ].filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy tệp để tải lên" }, { status: 400 });
  }
  if (options.maxFiles && files.length > options.maxFiles) {
    return NextResponse.json({ error: `Chỉ được tải lên tối đa ${options.maxFiles} tệp mỗi lần` }, { status: 400 });
  }

  // Giới hạn dung lượng: mỗi tệp phải nhỏ hơn 50MB (kiểm tra trước khi ghi bất kỳ tệp nào)
  const oversizedError = findOversizedFileError(files);
  if (oversizedError) {
    return NextResponse.json({ error: oversizedError }, { status: 400 });
  }

  // Kiểm tra toàn bộ tệp trước khi ghi xuống đĩa (không để lại tệp dở dang khi 1 tệp không hợp lệ)
  const prepared: { file: File; ext: string; fileType: ReturnType<typeof getFileType>; buffer: Buffer }[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    const originalName = file.name || "upload";
    const ext = path.extname(originalName).toLowerCase();

    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Định dạng tệp "${ext}" bị cấm tải lên vì lý do an toàn bảo mật hệ thống.` },
        { status: 400 }
      );
    }

    const fileType = getFileType(file.type || "", ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    if (fileType === "image" && !validateImageMagicBytes(buffer, file.type || "", ext)) {
      return NextResponse.json(
        { error: `Nội dung tệp "${originalName}" không đúng định dạng ảnh hoặc có thể bị hỏng/giả mạo.` },
        { status: 400 }
      );
    }
    prepared.push({ file, ext, fileType, buffer });
  }

  if (prepared.length === 0) {
    return NextResponse.json({ error: "Không có tệp hợp lệ nào được tải lên" }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const uploadedResults = [];
  for (const { file, ext, fileType, buffer } of prepared) {
    // Tên tệp lưu trữ bằng UUID ngẫu nhiên, chống path traversal và code injection
    const savedFileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, savedFileName), buffer);

    uploadedResults.push({
      fileName: path.basename(file.name || "upload").slice(0, 100),
      savedFileName,
      fileUrl: `/uploads/${savedFileName}`,
      fileType,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: options.uploadedBy,
    });
  }

  return NextResponse.json({ success: true, files: uploadedResults });
}
