import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

/**
 * Lấy khóa mã hóa AES-256 (32 bytes).
 * Ưu tiên ENCRYPTION_KEY, nếu không có thì dẫn xuất từ AUTH_SECRET bằng scryptSync.
 */
function getEncryptionKey(): Buffer {
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64) {
    try {
      const buf = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
      if (buf.length === 32) return buf;
    } catch {}
  }
  if (process.env.ENCRYPTION_KEY && Buffer.byteLength(process.env.ENCRYPTION_KEY) === 32) {
    return Buffer.from(process.env.ENCRYPTION_KEY, "utf-8");
  }
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "kztek-default-encryption-secret-key-change-in-prod";
  return crypto.scryptSync(secret, "kztek-system-salt", 32);
}

/**
 * Kiểm tra chuỗi đã được mã hóa theo chuẩn enc:v1:... chưa
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(PREFIX);
}

/**
 * Kiểm tra chuỗi có phải là chuỗi mặt nạ do frontend gửi lên không
 */
export function isMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  return value === "******" || value === "••••••••••••" || value === "••••••••";
}

/**
 * Trả về mặt nạ "******" nếu chuỗi có giá trị, ngược lại trả về rỗng.
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value || !value.trim()) return "";
  return "******";
}

/**
 * Mã hóa chuỗi nhạy cảm bằng AES-256-GCM.
 * Định dạng đầu ra: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string | null | undefined): string {
  if (!plaintext) return "";
  // Nếu đã được mã hóa thì không mã hóa lặp
  if (plaintext.startsWith(PREFIX)) return plaintext;
  // Nếu là chuỗi mặt nạ thì giữ nguyên
  if (isMasked(plaintext)) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Chuẩn 96-bit IV cho GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Giải mã an toàn chuỗi đã mã hóa bằng AES-256-GCM.
 * Nếu chuỗi là plaintext cũ (không có tiền tố enc:v1:) thì trả về nguyên bản (backward compatible).
 */
export function decryptSecret(cipherText: string | null | undefined): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith(PREFIX)) {
    // Tương thích ngược: dữ liệu plaintext cũ trước khi áp dụng mã hóa
    return cipherText;
  }

  try {
    const parts = cipherText.slice(PREFIX.length).split(":");
    if (parts.length !== 3) {
      return cipherText;
    }
    const [ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("⚠️ decryptSecret thất bại:", err);
    return "";
  }
}
