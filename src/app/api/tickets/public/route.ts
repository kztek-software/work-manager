import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasInlineDataUri } from "@/lib/ticket-status";
import { createTicket } from "@/lib/tickets";
import { notifyTicketCoordinators } from "@/lib/ticket-access";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { UPLOADED_FILE_URL_PATTERN } from "@/lib/upload-handler";

const MAX_PUBLIC_ATTACHMENTS = 10;
// Khớp URL do /api/upload trả về (không có "/" hay "\" sau tiền tố -> không thể trỏ ra ngoài thư mục uploads)
const PUBLIC_UPLOAD_URL_PATTERN = UPLOADED_FILE_URL_PATTERN;

// Khách hàng KHÔNG chọn dự án: mọi ticket từ portal được tạo với projectId = null,
// người có quyền tickets.assign sẽ điều phối tới dự án phù hợp.
const publicTicketSchema = z.object({
  title: z.string().min(3, "Tiêu đề phải có ít nhất 3 ký tự").max(200),
  description: z
    .string()
    .min(5, "Mô tả sự cố phải có ít nhất 5 ký tự")
    .max(20000, "Mô tả quá dài (tối đa 20.000 ký tự)")
    .refine((v) => !hasInlineDataUri(v), { message: "Ảnh trong mô tả phải được tải lên, không nhúng trực tiếp. Vui lòng dán lại ảnh." }),
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
        fileName: z.string().max(255),
        // Chỉ nhận file đã tải lên qua /api/upload: `/uploads/<timestamp>-<16 hex>-<tên đã làm sạch><ext>`
        fileUrl: z.string().regex(PUBLIC_UPLOAD_URL_PATTERN, "Đường dẫn tệp đính kèm không hợp lệ"),
        fileType: z.string().optional(),
        fileSize: z.number().optional().nullable(),
        mimeType: z.string().optional().nullable(),
      })
    )
    .max(MAX_PUBLIC_ATTACHMENTS, `Tối đa ${MAX_PUBLIC_ATTACHMENTS} tệp đính kèm`)
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

    // Tạo ticket mới, luôn chưa gán dự án (chờ điều phối)
    const ticket = await createTicket({
      projectId: null,
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

    // Thông báo tới người có quyền điều phối (tickets.assign); realtime đã phát trong createTicket
    try {
      await notifyTicketCoordinators(ticket);
    } catch (notifyErr) {
      console.error("Lỗi khi gửi thông báo cho người điều phối:", notifyErr);
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
