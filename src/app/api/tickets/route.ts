import { NextRequest, NextResponse } from "next/server";
import { getTicketsByProject, createTicket } from "@/lib/tickets";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = new URL(req.url);

    const projectId = searchParams.get("projectId") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const priority = searchParams.get("priority") || "ALL";
    const type = searchParams.get("type") || "ALL";
    const search = searchParams.get("search") || undefined;
    const unassignedOnly = searchParams.get("unassignedOnly") === "true";

    const result = await getTicketsByProject(projectId, {
      status,
      priority,
      type,
      search,
      unassignedOnly,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/tickets error:", err);
    return NextResponse.json({ error: "Lỗi tải danh sách tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests / phút / IP
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`ticket_create:${clientIp}`, { maxRequests: 5, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse(
        "Bạn đã tạo quá nhiều tickets trong thời gian ngắn. Vui lòng thử lại sau 1 phút.",
        rl
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.title || !body.customerName || !body.customerEmail) {
      return NextResponse.json(
        { error: "Tiêu đề, tên khách hàng và email là bắt buộc" },
        { status: 400 }
      );
    }

    const ticket = await createTicket(body);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tickets error:", err);
    return NextResponse.json({ error: "Lỗi tạo ticket" }, { status: 500 });
  }
}
