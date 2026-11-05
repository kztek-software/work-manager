import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Dọn dẹp store định kỳ sau mỗi 5 phút để tránh memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredRecords(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && store.size < 5000) return;
  lastCleanup = now;

  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < maxWindowMs);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitOptions {
  /** Thời gian của cửa sổ tính theo ms (mặc định 60,000ms = 1 phút) */
  windowMs?: number;
  /** Số request tối đa được phép trong cửa sổ */
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Trích xuất IP của client từ headers
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();

  return "127.0.0.1";
}

/**
 * Kiểm tra giới hạn tần suất request (sliding window) theo key
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const windowMs = options.windowMs ?? 60 * 1000;
  const maxRequests = options.maxRequests;
  const now = Date.now();

  cleanupExpiredRecords(now, windowMs * 2);

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Lọc bỏ các timestamp đã trôi qua ngoài cửa sổ windowMs
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0] || now;
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  // Thêm request hiện tại vào lịch sử
  record.timestamps.push(now);

  const remaining = Math.max(0, maxRequests - record.timestamps.length);
  const oldestTimestamp = record.timestamps[0] || now;
  const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));

  return {
    success: true,
    limit: maxRequests,
    remaining,
    resetMs,
  };
}

/**
 * Tạo NextResponse 429 Too Many Requests kèm đầy đủ chuẩn HTTP headers
 */
export function createRateLimitResponse(
  message = "Quá nhiều yêu cầu, vui lòng thử lại sau.",
  result?: RateLimitResult
): NextResponse {
  const resetSeconds = result ? Math.ceil(result.resetMs / 1000) : 60;

  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: resetSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetSeconds),
        ...(result
          ? {
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetMs) / 1000)),
            }
          : {}),
      },
    }
  );
}

/**
 * Xóa lịch sử rate-limit của một key (hữu ích cho unit test / reset)
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Xóa toàn bộ lịch sử rate limit trong memory (hữu ích cho unit test)
 */
export function clearAllRateLimits(): void {
  store.clear();
}
