import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// 25MB cho ảnh/tài liệu, 100MB cho video
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

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

export async function POST(req: NextRequest) {
  try {
    // 1. Kiểm tra Rate Limit: 20 requests / phút / IP
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`upload:${clientIp}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse("Bạn đã tải lên quá nhiều tệp trong thời gian ngắn. Vui lòng thử lại sau 1 phút.", rl);
    }

    // 2. Bắt buộc kiểm tra Authentication (G0-4)
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập để tải lên tệp tin" }, { status: 401 });
    }

    const formData = await req.formData();

    // Hỗ trợ cả 3 key "files", "file" và "attachments" trong FormData
    const files = [
      ...(formData.getAll("files") as File[]),
      ...(formData.getAll("file") as File[]),
      ...(formData.getAll("attachments") as File[]),
    ];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy tệp để tải lên" }, { status: 400 });
    }

    // Đảm bảo thư mục lưu trữ tồn tại
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const uploadedResults = [];

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      const originalName = file.name || "upload";
      const ext = path.extname(originalName).toLowerCase();

      // 3. Kiểm tra danh sách phần mở rộng cấm tuyệt đối (G0-4)
      if (FORBIDDEN_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          {
            error: `Định dạng tệp "${ext}" bị cấm tải lên vì lý do an toàn bảo mật hệ thống.`,
          },
          { status: 400 }
        );
      }

      const fileType = getFileType(file.type || "", ext);
      const maxSize = fileType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

      if (file.size > maxSize) {
        return NextResponse.json(
          {
            error: `Tệp "${originalName}" vượt quá dung lượng tối đa cho phép (${
              fileType === "video" ? "100MB cho video" : "25MB cho ảnh/tài liệu"
            })`,
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // 4. Kiểm tra magic bytes đối với các tệp ảnh
      if (fileType === "image") {
        const isValidImage = validateImageMagicBytes(buffer, file.type || "", ext);
        if (!isValidImage) {
          return NextResponse.json(
            {
              error: `Nội dung tệp "${originalName}" không đúng định dạng ảnh hoặc có thể bị hỏng/giả mạo.`,
            },
            { status: 400 }
          );
        }
      }

      // 5. Sinh tên tệp lưu trữ bằng UUID ngẫu nhiên, chống path traversal và code injection
      const randomId = crypto.randomUUID();
      const savedFileName = `${Date.now()}-${randomId}${ext}`;
      const filePath = path.join(UPLOAD_DIR, savedFileName);

      await fs.writeFile(filePath, buffer);

      const fileUrl = `/uploads/${savedFileName}`;

      // Tên hiển thị làm sạch ký tự lạ
      const safeDisplayName = path.basename(originalName).slice(0, 100);

      uploadedResults.push({
        fileName: safeDisplayName,
        savedFileName,
        fileUrl,
        fileType,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedBy: user.name || user.email,
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
