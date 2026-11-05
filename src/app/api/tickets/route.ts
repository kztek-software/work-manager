import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasInlineDataUri } from "@/lib/ticket-status";
import { getTickets, createTicket } from "@/lib/tickets";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTicketScopeWhere,
  canCreateTickets,
  canUseTicketModule,
  getTicketAccess,
  getTicketCapabilities,
  getTicketProjectOptions,
  notifyTicketCoordinators,
  ticketRouteError,
} from "@/lib/ticket-access";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/tickets?projectId=ALL|UNASSIGNED|<id>&status=&priority=&type=&search=
// Danh sách ticket trong phạm vi xem của user (xem src/lib/ticket-access.ts)
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const access = await getTicketAccess(user);
    if (!canUseTicketModule(access)) {
      return NextResponse.json({ error: "Bạn không có quyền xem Ticket khách hàng" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // unassignedOnly=true: tương thích client cũ (desktop/mobile)
    // ALL / UNASSIGNED không phân biệt hoa thường; còn lại là id dự án
    const rawProject = (searchParams.get("projectId") || "").trim();
    const upperProject = rawProject.toUpperCase();
    const project =
      searchParams.get("unassignedOnly") === "true" || upperProject === "UNASSIGNED"
        ? "UNASSIGNED"
        : !rawProject || upperProject === "ALL"
        ? "ALL"
        : rawProject;

    if (project === "UNASSIGNED" && !access.canAssign) {
      return NextResponse.json(
        { error: "Chỉ người có quyền điều phối mới xem được ticket chưa gán dự án" },
        { status: 403 }
      );
    }

    const [result, projects] = await Promise.all([
      getTickets({
        scopeWhere: buildTicketScopeWhere(access),
        project,
        status: searchParams.get("status") || "ALL",
        priority: searchParams.get("priority") || "ALL",
        type: searchParams.get("type") || "ALL",
        search: searchParams.get("search") || undefined,
        // Người xử lý: ALL | ME | NONE | <userId> (không phân biệt hoa thường với ALL/ME/NONE)
        assignee: normalizeAssigneeFilter(searchParams.get("assignee")),
        currentUserId: user.id,
        includeUnassignedCount: access.canAssign,
      }),
      getTicketProjectOptions(access),
    ]);

    return NextResponse.json({
      tickets: result.tickets.map((t) => ({ ...t, capabilities: getTicketCapabilities(access, t) })),
      stats: result.stats,
      projects,
      canAssign: access.canAssign,
      canCreate: canCreateTickets(access),
    });
  } catch (err) {
    return ticketRouteError(err, "GET /api/tickets error:", "Lỗi tải danh sách tickets");
  }
}

function normalizeAssigneeFilter(raw: string | null): string {
  const value = (raw || "").trim();
  const upper = value.toUpperCase();
  if (!value || upper === "ALL") return "ALL";
  if (upper === "ME" || upper === "NONE") return upper;
  return value;
}

const createInternalTicketSchema = z.object({
  projectId: z.string().nullable().optional(),
  title: z.string().min(3).max(200),
  description: z
    .string()
    .min(5, "Mô tả sự cố phải có ít nhất 5 ký tự")
    .max(20000, "Mô tả quá dài (tối đa 20.000 ký tự)")
    .refine((v) => !hasInlineDataUri(v), { message: "Ảnh trong mô tả phải được tải lên, không nhúng trực tiếp. Vui lòng dán lại ảnh." }),
  type: z.enum(["BUG", "SUPPORT", "INQUIRY", "FEATURE_REQ"]).default("BUG"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email().max(150),
  customerPhone: z.string().max(30).optional().nullable(),
  customerCompany: z.string().max(150).optional().nullable(),
  environment: z.string().max(500).optional().nullable(),
});

// POST /api/tickets -> Nhân viên ghi nhận ticket thay khách hàng
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests / phút / IP (giữ từ main)
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`ticket_create:${clientIp}`, { maxRequests: 5, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse(
        "Bạn đã tạo quá nhiều tickets trong thời gian ngắn. Vui lòng thử lại sau 1 phút.",
        rl
      );
    }

    const user = await requireUser(req);
    const access = await getTicketAccess(user);
    if (!canCreateTickets(access)) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này (Yêu cầu quyền: tickets.create)" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createInternalTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Tiêu đề, tên khách hàng và email là bắt buộc" },
        { status: 400 }
      );
    }

    const { projectId, ...data } = parsed.data;

    // Chỉ người có tickets.assign mới được gán dự án ngay khi tạo
    if (projectId && !access.canAssign) {
      return NextResponse.json(
        { error: "Bạn không có quyền gán dự án cho ticket (Yêu cầu quyền: tickets.assign)" },
        { status: 403 }
      );
    }
    if (projectId) {
      const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
      }
    }

    const ticket = await createTicket({ ...data, projectId: projectId || null, actorId: user.id });

    // Ticket chưa gán dự án -> vào hàng chờ, báo cho người điều phối
    if (!ticket.projectId) {
      notifyTicketCoordinators(ticket, {
        actorId: user.id,
        source: `${user.name} (ghi nhận nội bộ cho khách ${ticket.customerName})`,
      }).catch((e) => console.error("Lỗi gửi thông báo ticket mới:", e));
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return ticketRouteError(err, "POST /api/tickets error:", "Lỗi tạo ticket");
  }
}
