import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTicket } from "@/lib/tickets";
import { sendNotification } from "@/lib/notifications";
import { publish } from "@/lib/bus";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";

const publicTicketSchema = z.object({
  projectId: z.string().optional().nullable(),
  projectKey: z.string().optional().nullable(),
  title: z.string().min(3, "Tiêu đề phải có ít nhất 3 ký tự").max(200),
  description: z.string().min(5, "Mô tả sự cố phải có ít nhất 5 ký tự").max(5000),
  type: z.enum(["BUG", "SUPPORT", "INQUIRY", "FEATURE_REQ"]).default("BUG"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerName: z.string().min(2, "Họ và tên ít nhất 2 ký tự").max(100),
  customerEmail: z.string().email("Email không hợp lệ").max(150),
  customerPhone: z.string().max(30).optional().nullable(),
  customerCompany: z.string().max(150).optional().nullable(),
  environment: z.string().max(500).optional().nullable(),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileType: z.string().optional(),
        fileSize: z.number().optional().nullable(),
        mimeType: z.string().optional().nullable(),
      })
    )
    .optional(),
});

// GET /api/tickets/public
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "KZTEK Customer Portal Intake API is active",
  });
}

// POST /api/tickets/public -> Gửi ticket báo lỗi từ khách hàng (Không cần chọn dự án)
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests / phút / IP chống spam tickets
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`ticket_public:${clientIp}`, { maxRequests: 5, windowMs: 60 * 1000 });
    if (!rl.success) {
      return createRateLimitResponse(
        "Bạn đã gửi quá nhiều yêu cầu báo lỗi. Vui lòng thử lại sau 1 phút.",
        rl
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = publicTicketSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const d = parsed.data;

    // Tìm Project nếu có cung cấp explicit (không bắt buộc)
    let targetProject = null;
    if (d.projectId) {
      targetProject = await prisma.project.findUnique({
        where: { id: d.projectId },
        select: { id: true, name: true, key: true },
      });
    } else if (d.projectKey) {
      targetProject = await prisma.project.findUnique({
        where: { key: d.projectKey.toUpperCase() },
        select: { id: true, name: true, key: true },
      });
    }

    // Tạo ticket mới (projectId có thể null nếu chờ Admin điều phối)
    const ticket = await createTicket({
      projectId: targetProject?.id || null,
      title: d.title,
      description: d.description,
      type: d.type,
      priority: d.priority,
      customerName: d.customerName,
      customerEmail: d.customerEmail,
      customerPhone: d.customerPhone,
      customerCompany: d.customerCompany,
      environment: d.environment,
      attachments: d.attachments,
    });

    // Gửi thông báo đến TẤT CẢ các tài khoản ADMIN để điều phối tới dự án phù hợp
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
      });

      // Lấy 1 project bất kỳ nếu có để làm đường dẫn xem ticket
      const anyProject = targetProject || (await prisma.project.findFirst({ select: { id: true } }));
      const ticketLink = anyProject
        ? `/projects/${anyProject.id}/tickets?ticketId=${ticket.id}`
        : `/portal/tickets/${ticket.trackingCode}`;

      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          type: "TICKET_CREATED",
          title: `🎫 Báo lỗi mới: ${ticket.title}`,
          message: `Khách hàng ${ticket.customerName} (${ticket.customerEmail}) vừa gửi ticket "${ticket.trackingCode}". Cần Admin điều phối tới dự án phù hợp.`,
          link: ticketLink,
        });
      }

      // Publish global SSE event
      publish("GLOBAL", {
        type: "TICKET_CREATED",
        ticketId: ticket.id,
        actorId: "customer",
      });
    } catch (notifyErr) {
      console.error("Lỗi khi gửi thông báo cho admin:", notifyErr);
    }

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: ticket.id,
          trackingCode: ticket.trackingCode,
          title: ticket.title,
          status: ticket.status,
          customerName: ticket.customerName,
          project: targetProject || null,
          createdAt: ticket.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Lỗi khi tạo ticket từ khách hàng:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi gửi yêu cầu báo lỗi. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
