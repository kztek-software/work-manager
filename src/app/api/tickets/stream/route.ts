import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { subscribe, TICKETS_ROOM } from "@/lib/bus";
import { canUseTicketModule, canViewTicketInProject, getTicketAccess } from "@/lib/ticket-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/stream
 * Realtime SSE cho module Ticket: lắng nghe room TICKETS_ROOM (mọi sự kiện ticket, kể cả ticket
 * chưa gán dự án) và CHỈ chuyển tiếp sự kiện của ticket user được xem — trước hoặc sau khi điều phối.
 * Phạm vi xem được tính 1 lần lúc kết nối; client tải lại danh sách qua /api/tickets (kiểm quyền đầy đủ).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const access = await getTicketAccess(user);
  if (!canUseTicketModule(access)) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`));

      unsubscribe = subscribe(TICKETS_ROOM, (event) => {
        const visible =
          canViewTicketInProject(access, event.projectId) ||
          (Boolean(event.prevProjectId) && canViewTicketInProject(access, event.prevProjectId));
        if (!visible) return;
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: event.type, ticketId: event.ticketId, actorId: event.actorId, at: event.at })}\n\n`
            )
          );
        } catch {
          // stream đã đóng
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // đã đóng
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
