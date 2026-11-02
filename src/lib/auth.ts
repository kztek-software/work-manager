import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { prisma } from "./prisma";

const scryptAsync = promisify(scrypt);

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "flowboard-dev-secret-change-me-in-production"
);
const COOKIE_NAME = "flowboard_session";
const SESSION_DAYS = 7;

/** Băm mật khẩu bất đồng bộ không block Event Loop */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/** Xác minh mật khẩu bất đồng bộ */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const candidate = (await scryptAsync(password, salt, 64)) as Buffer;
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/** Sinh mật khẩu tạm ngẫu nhiên (bỏ các ký tự dễ nhầm như 0/O, 1/l/I) */
export function generateTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title: string | null;
  role: string;
  mustChangePassword: boolean;
  isActive: boolean;
  tokenVersion: number;
};

export async function createJwtToken(
  userId: string,
  extraPayload?: { role?: string; tokenVersion?: number }
): Promise<string> {
  const jwt = new SignJWT({
    sub: userId,
    ...(extraPayload?.role ? { role: extraPayload.role } : {}),
    ...(extraPayload?.tokenVersion !== undefined ? { tokenVersion: extraPayload.tokenVersion } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`);

  return await jwt.sign(SECRET);
}

export async function createSession(
  userId: string,
  tokenVersion?: number,
  role?: string
): Promise<string> {
  let tv = tokenVersion;
  let userRole = role;

  if (tv === undefined || userRole === undefined) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true, role: true },
    });
    if (u) {
      if (tv === undefined) tv = u.tokenVersion;
      if (userRole === undefined) userRole = u.role;
    }
  }

  const token = await createJwtToken(userId, {
    tokenVersion: tv ?? 1,
    role: userRole ?? "MEMBER",
  });

  try {
    const store = await cookies();
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: "/",
    });
  } catch {
    // In pure API context where cookie store cannot be modified, ignore
  }

  return token;
}

export async function destroySession() {
  try {
    const store = await cookies();
    store.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 0,
      path: "/",
    });
  } catch {
    // Ignore error if cookie store cannot be modified
  }
}

export async function getSessionUser(req?: Request | null): Promise<SessionUser | null> {
  let token: string | undefined;

  // 1. Kiểm tra Header Authorization & Cookie từ request truyền vào
  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    }
  }

  // 2. Kiểm tra Header Authorization từ next/headers
  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization") || headerStore.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // headers() có thể ném exception nếu chạy ngoài request context
    }
  }

  // 3. Fallback kiểm tra Cookie session
  if (!token) {
    try {
      const store = await cookies();
      token = store.get(COOKIE_NAME)?.value;
    } catch {
      // cookies() có thể ném exception
    }
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        title: true,
        role: true,
        mustChangePassword: true,
        isActive: true,
        tokenVersion: true,
      },
    });

    if (!user) return null;

    // Chặn tài khoản bị vô hiệu hóa
    if (!user.isActive) {
      return null;
    }

    // Đối chiếu tokenVersion trong token với DB để thu hồi phiên cũ khi đổi mật khẩu
    const payloadVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : null;
    if (payloadVersion === null || payloadVersion !== user.tokenVersion) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function requireUser(req?: Request | null): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}
