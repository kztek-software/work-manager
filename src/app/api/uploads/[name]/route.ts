import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

// GET /uploads/<tên tệp> (rewrite từ next.config.ts) -> phục vụ tệp người dùng đã upload.
// Bản build production của Next chỉ phục vụ tệp có trong public/ LÚC KHỞI ĐỘNG, nên tệp upload sau đó sẽ 404.
// Route này đọc trực tiếp từ đĩa để tệp mới hiển thị ngay, kèm các header an toàn như cấu hình /uploads của main.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
// Chỉ cho phép tên tệp phẳng (không có / hay \ hay ..) -> chống path traversal
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
};
// Loại hiển thị trực tiếp trên trình duyệt; còn lại buộc tải xuống
const INLINE_TYPES = /^(image\/|video\/|application\/pdf|text\/plain)/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!SAFE_NAME.test(name) || name.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, name);
  let size: number;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
    size = stat.size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Frame-Options": "DENY",
    "Cache-Control": "private, max-age=86400",
    "Accept-Ranges": "bytes",
    "Content-Disposition": INLINE_TYPES.test(contentType) ? "inline" : "attachment",
  };

  // Hỗ trợ Range (1 khoảng) để tua video
  const range = req.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    let start = match[1] ? parseInt(match[1], 10) : size - parseInt(match[2], 10);
    let end = match[1] && match[2] ? parseInt(match[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
