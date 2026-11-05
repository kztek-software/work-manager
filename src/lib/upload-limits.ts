// Giới hạn dung lượng tệp tải lên — dùng chung cho server & client.
// Mỗi tệp phải NHỎ HƠN 50MB (áp dụng cho mọi loại: ảnh, video, tài liệu).
export const MAX_UPLOAD_SIZE_MB = 50;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const UPLOAD_SIZE_LIMIT_LABEL = `Tối đa dưới ${MAX_UPLOAD_SIZE_MB}MB/tệp`;

export function isFileTooLarge(size: number): boolean {
  return size >= MAX_UPLOAD_SIZE_BYTES;
}

export function fileTooLargeMessage(fileName: string): string {
  return `Tệp "${fileName}" vượt quá dung lượng cho phép (phải nhỏ hơn ${MAX_UPLOAD_SIZE_MB}MB)`;
}

/** Trả về thông báo lỗi cho tệp đầu tiên vượt giới hạn, hoặc null nếu tất cả hợp lệ */
export function findOversizedFileError(files: ArrayLike<{ name: string; size: number }>): string | null {
  for (let i = 0; i < files.length; i++) {
    if (isFileTooLarge(files[i].size)) return fileTooLargeMessage(files[i].name || "tệp");
  }
  return null;
}
