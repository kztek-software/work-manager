import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getTicketById } from "@/lib/tickets";
import { findAccessibleTicket, getTicketAccess, getTicketCapabilities, ticketRouteError } from "@/lib/ticket-access";
import { performTicketAction, TicketWorkflowError } from "@/lib/ticket-workflow";
import {
  TICKET_CANCEL_REASONS,
  TICKET_CLOSE_REASONS,
  htmlToPlainText,
  hasInlineDataUri,
  INLINE_DATA_URI_ERROR,
} from "@/lib/ticket-status";

// Mô tả kết quả Đóng / Hủy: HTML từ WysiwygEditor, bắt buộc có nội dung sau khi bỏ tag
const descriptionSchema = z
  .string()
  .max(20000, "Mô tả quá dài (tối đa 20.000 ký tự)")
  .refine((v) => htmlToPlainText(v).length > 0, { message: "Vui lòng nhập mô tả kết quả xử lý" })
  .refine((v) => !hasInlineDataUri(v), { message: INLINE_DATA_URI_ERROR });

// POST /api/tickets/[ticketId]/actions — mọi chuyển trạng thái ticket đi qua đây (server là nguồn sự thật).
// OPEN -> ACKNOWLEDGED tự động khi mở chi tiết (GET /api/tickets/[ticketId]); -> TRIAGED tự động khi đủ điều kiện.
const actionSchema = z.discriminatedUnion("action", [
  // Xác nhận mức ưu tiên (giữ nguyên giá trị cũng được tính là đã xác nhận)
  z.object({ action: z.literal("confirm_priority"), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]) }),
  // Tự nhận xử lý; start = true -> "Nhận & bắt đầu xử lý" nếu ticket đã phân loại
  z.object({ action: z.literal("claim"), start: z.boolean().optional() }),
  // Người điều phối giao / bỏ giao (null) người xử lý
  z.object({ action: z.literal("assign"), assigneeId: z.string().min(1, "Người xử lý không hợp lệ").nullable() }),
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("close"),
    reason: z.enum(TICKET_CLOSE_REASONS, { message: "Vui lòng chọn lý do đóng ticket" }),
    description: descriptionSchema,
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.enum(TICKET_CANCEL_REASONS, { message: "Vui lòng chọn lý do hủy ticket" }),
    description: descriptionSchema,
  }),
  z.object({ action: z.literal("reopen"), note: z.string().max(2000).optional() }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requireUser(req);
    const { ticketId } = await params;

    const access = await getTicketAccess(user);
    const row = await findAccessibleTicket(access, ticketId);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy ticket" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Hành động không hợp lệ" },
        { status: 400 }
      );
    }

    try {
      await performTicketAction({ ticketId: row.id, user, access, input: parsed.data });
    } catch (err) {
      if (err instanceof TicketWorkflowError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus });
      }
      throw err;
    }

    const ticket = await getTicketById(row.id, true);
    return NextResponse.json({
      success: true,
      ticket: ticket && { ...ticket, capabilities: getTicketCapabilities(access, ticket) },
    });
  } catch (error) {
    return ticketRouteError(error, "Lỗi thực hiện hành động ticket:");
  }
}
