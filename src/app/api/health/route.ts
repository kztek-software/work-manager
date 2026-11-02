import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint phục vụ Docker Compose, Kubernetes, Load Balancer và giám sát hệ thống
 */
export async function GET() {
  try {
    // Kiểm tra kết nối DB PostgreSQL bằng truy vấn nhẹ
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Health check DB connection failed:", err);

    return NextResponse.json(
      {
        status: "degraded",
        db: "disconnected",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        error: err?.message || "Database connection error",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
