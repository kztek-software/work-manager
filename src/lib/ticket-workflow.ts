import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";
import { addTicketComment, publishTicketEvent, type TicketTx } from "@/lib/tickets";
import { buildTicketActor, getTicketAccess, type TicketAccess } from "@/lib/ticket-access";
import { notifyCustomerAboutTicket } from "@/lib/ticket-mail";
import {
  TicketWorkflowError,
  checkTicketAction,
  computeAutoStatus,
  isTicketFinal,
  computeReopenStatus,
  TICKET_PRIORITY_LABELS,
  ticketStatusLabel,
  type TicketActionName,
  type TicketWorkflowState,
} from "@/lib/ticket-status";

// ---------------------------------------------------------------------------
// Thực thi luồng trạng thái ticket phía server (nguồn sự thật).
// Luật thuần nằm ở src/lib/ticket-status.ts; file này đọc/ghi DB, ghi comment hệ thống,
// phát realtime, gửi thông báo / email sau khi transaction commit.
// ---------------------------------------------------------------------------

type Actor = { id: string; name: string };

// Lỗi nghiệp vụ định nghĩa ở ticket-status.ts (tickets.ts cũng dùng, tránh import vòng) — re-export cho route
export { TicketWorkflowError };

const WORKFLOW_SELECT = {
  id: true,
  status: true,
  projectId: true,
  assigneeId: true,
  acknowledgedAt: true,
  priorityConfirmedAt: true,
  closeReason: true,
  resolutionNotes: true,
  startedAt: true,
} as const;

/** Comment hệ thống nội bộ (khách không thấy) ghi lại thay đổi trạng thái */
async function addSystemComment(tx: TicketTx, ticketId: string, actor: Actor, message: string) {
  await addTicketComment(
    { ticketId, authorName: actor.name, isStaff: true, isInternalOnly: true, message, actorId: actor.id },
    { db: tx, publishEvent: false }
  );
}

/**
 * Cập nhật có điều kiện theo dữ liệu đã đọc (trạng thái, người xử lý, dự án) — request khác đổi
 * đồng thời -> không khớp dòng nào -> 409 và transaction rollback.
 */
async function guardedUpdate(
  tx: TicketTx,
  ticketId: string,
  expected: { status: string; assigneeId?: string | null; projectId?: string | null },
  data: Record<string, unknown>
) {
  const where: Record<string, unknown> = { id: ticketId, status: expected.status };
  if (expected.assigneeId !== undefined) where.assigneeId = expected.assigneeId;
  if (expected.projectId !== undefined) where.projectId = expected.projectId;
  const res = await tx.customerTicket.updateMany({ where, data });
  if (res.count === 0) {
    throw new TicketWorkflowError(409, "Ticket vừa được người khác cập nhật. Vui lòng tải lại và thử lại.");
  }
}

// Trường user cần để tính quyền ticket (khớp kiểu SessionUser)
const HANDLER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarColor: true,
  title: true,
  role: true,
  mustChangePassword: true,
  isActive: true,
  tokenVersion: true,
} as const;

/** User có đủ điều kiện làm người xử lý ticket của dự án không: thành viên/chủ dự án + có quyền xử lý ticket */
export async function isEligibleTicketHandler(userId: string, projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: HANDLER_USER_SELECT,
  });
  // Tài khoản đã bị vô hiệu hóa không được làm người xử lý
  if (!user || !user.isActive) return false;
  const access = await getTicketAccess(user);
  return buildTicketActor(access, projectId).isEligibleHandler;
}

/** Danh sách người có thể được giao xử lý ticket trong dự án */
export async function getEligibleTicketHandlers(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { user: { select: HANDLER_USER_SELECT } },
  });
  const owner = await prisma.project.findUnique({
    where: { id: projectId },
    select: { owner: { select: HANDLER_USER_SELECT } },
  });
  const candidates = new Map(members.map((m) => [m.user.id, m.user]));
  if (owner?.owner) candidates.set(owner.owner.id, owner.owner);

  const result: { id: string; name: string; avatarColor: string; title: string | null }[] = [];
  for (const u of candidates.values()) {
    if (!u.isActive) continue;
    const access = await getTicketAccess(u);
    if (buildTicketActor(access, projectId).isEligibleHandler) {
      result.push({ id: u.id, name: u.name, avatarColor: u.avatarColor, title: u.title });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * Áp dụng các chuyển trạng thái TỰ ĐỘNG sau mọi thao tác có thể đổi điều kiện
 * (điều phối dự án, xác nhận ưu tiên, giao/bỏ người xử lý, mở lại...):
 * 1. Người xử lý không còn hợp lệ (mất dự án / không thuộc dự án mới / mất quyền) -> bỏ gán.
 * 2. computeAutoStatus: OPEN/ACKNOWLEDGED -> TRIAGED khi đủ (ưu tiên đã xác nhận + có dự án);
 *    lùi trạng thái khi mất dự án / mất người xử lý.
 * Trả về trạng thái cuối và người xử lý bị bỏ gán (nếu có).
 */
export async function applyAutoStatusTransitions(
  tx: TicketTx,
  ticketId: string,
  actor: Actor
): Promise<{ status: string; changed: boolean; clearedAssigneeId: string | null }> {
  const t = await tx.customerTicket.findUnique({ where: { id: ticketId }, select: WORKFLOW_SELECT });
  if (!t) throw new TicketWorkflowError(404, "Không tìm thấy ticket");
  // Ticket đã Đóng / Hủy: giữ nguyên lịch sử (không bỏ người xử lý, không đổi trạng thái)
  if (isTicketFinal(t.status)) return { status: t.status, changed: false, clearedAssigneeId: null };

  let assigneeId = t.assigneeId;
  let clearedAssigneeId: string | null = null;
  if (assigneeId && !(await isEligibleTicketHandler(assigneeId, t.projectId))) {
    clearedAssigneeId = assigneeId;
    assigneeId = null;
    await tx.customerTicket.update({ where: { id: ticketId }, data: { assigneeId: null } });
    await addSystemComment(
      tx,
      ticketId,
      actor,
      "[Trạng thái] Người xử lý không còn thuộc dự án phụ trách của ticket — đã bỏ gán người xử lý."
    );
  }

  const next = computeAutoStatus({ ...t, assigneeId });
  if (next.status === t.status && !next.markAcknowledged) {
    return { status: t.status, changed: clearedAssigneeId !== null, clearedAssigneeId };
  }

  const now = new Date();
  await tx.customerTicket.update({
    where: { id: ticketId },
    data: {
      status: next.status,
      ...(next.markAcknowledged ? { acknowledgedAt: now, acknowledgedById: actor.id } : {}),
    },
  });
  if (next.status !== t.status) {
    await addSystemComment(
      tx,
      ticketId,
      actor,
      `[Trạng thái] Tự động chuyển từ "${ticketStatusLabel(t.status)}" sang "${ticketStatusLabel(next.status)}".`
    );
  }
  return { status: next.status, changed: true, clearedAssigneeId };
}

/**
 * Nhân viên (đã đăng nhập, có quyền xem) mở chi tiết ticket lần đầu: OPEN -> ACKNOWLEDGED.
 * Idempotent: chỉ ticket còn OPEN mới đổi. Khách xem ở portal KHÔNG gọi hàm này.
 */
export async function acknowledgeTicketOnView(ticketId: string, user: Actor): Promise<boolean> {
  const changed = await prisma.$transaction(async (tx) => {
    const res = await tx.customerTicket.updateMany({
      where: { id: ticketId, status: "OPEN" },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: user.id },
    });
    if (res.count === 0) return false;
    await addSystemComment(tx, ticketId, user, `[Trạng thái] ${user.name} đã tiếp nhận ticket (Mới → Đã tiếp nhận).`);
    // Ticket có thể đã đủ điều kiện phân loại từ trước (ưu tiên + dự án)
    await applyAutoStatusTransitions(tx, ticketId, user);
    return true;
  });

  if (changed) {
    const t = await prisma.customerTicket.findUnique({ where: { id: ticketId }, select: { projectId: true } });
    publishTicketEvent({ type: "TICKET_UPDATED", ticketId, actorId: user.id }, t?.projectId ?? null);
  }
  return changed;
}

export type TicketActionInput =
  | { action: "confirm_priority"; priority: string }
  | { action: "claim"; start?: boolean }
  | { action: "assign"; assigneeId: string | null }
  | { action: "start" }
  | { action: "close"; reason: string; description: string }
  | { action: "cancel"; reason: string; description: string }
  | { action: "reopen"; note?: string };

/**
 * Thực hiện 1 hành động theo luồng trạng thái. Kiểm tra quyền + trạng thái (checkTicketAction),
 * ghi trong 1 transaction, sau khi commit mới phát realtime / thông báo / email.
 */
export async function performTicketAction(params: {
  ticketId: string;
  user: SessionUser;
  access: TicketAccess;
  input: TicketActionInput;
}): Promise<{ status: string }> {
  const { ticketId, user, access, input } = params;
  const actorRef: Actor = { id: user.id, name: user.name };

  let notifyAssigneeId: string | null = null;
  // Snapshot kết quả lúc commit -> email cho khách không phụ thuộc lần đọc lại sau đó
  let resultSnapshot: { status: string; closeReason: string; resolutionNotes: string } | null = null;
  let projectIdForEvent: string | null = null;

  const finalStatus = await prisma.$transaction(async (tx) => {
    // Đọc + kiểm tra quyền/trạng thái TRONG transaction; mọi update đều có điều kiện theo dữ liệu đã đọc
    const current = await tx.customerTicket.findUnique({ where: { id: ticketId }, select: WORKFLOW_SELECT });
    if (!current) throw new TicketWorkflowError(404, "Không tìm thấy ticket");
    projectIdForEvent = current.projectId;

    const state: TicketWorkflowState = current;
    const actor = buildTicketActor(access, current.projectId);
    // Người được giao (assign) phải đủ điều kiện — kiểm tra DB trước khi gọi luật thuần
    let targetEligible: boolean | undefined;
    if (input.action === "assign" && input.assigneeId) {
      targetEligible = await isEligibleTicketHandler(input.assigneeId, current.projectId);
    }
    const check = checkTicketAction(input.action as TicketActionName, state, actor, {
      targetId: input.action === "assign" ? input.assigneeId : undefined,
      targetEligible,
    });
    if (!check.ok) throw new TicketWorkflowError(check.httpStatus, check.error);

    // Điều kiện khóa: trạng thái + người xử lý + dự án đúng như lúc kiểm tra quyền
    const expected = { status: current.status, assigneeId: current.assigneeId, projectId: current.projectId };
    const now = new Date();
    switch (input.action) {
      case "confirm_priority": {
        await guardedUpdate(tx, ticketId, { status: current.status }, {
          priority: input.priority,
          priorityConfirmedAt: now,
          priorityConfirmedById: user.id,
        });
        await addSystemComment(
          tx,
          ticketId,
          actorRef,
          `[Phân loại] ${user.name} đã xác nhận mức ưu tiên: ${TICKET_PRIORITY_LABELS[input.priority] || input.priority}.`
        );
        break;
      }
      case "claim": {
        await guardedUpdate(tx, ticketId, expected, { assigneeId: user.id });
        await addSystemComment(tx, ticketId, actorRef, `[Người xử lý] ${user.name} đã nhận xử lý ticket.`);
        break;
      }
      case "assign": {
        await guardedUpdate(tx, ticketId, expected, { assigneeId: input.assigneeId });
        if (input.assigneeId) {
          const target = await tx.user.findUnique({ where: { id: input.assigneeId }, select: { name: true } });
          await addSystemComment(
            tx,
            ticketId,
            actorRef,
            `[Người xử lý] ${user.name} đã giao ticket cho ${target?.name || "người xử lý"}.`
          );
          if (input.assigneeId !== user.id) notifyAssigneeId = input.assigneeId;
        } else {
          await addSystemComment(tx, ticketId, actorRef, `[Người xử lý] ${user.name} đã bỏ gán người xử lý.`);
        }
        break;
      }
      case "start": {
        await guardedUpdate(tx, ticketId, expected, { status: "IN_PROGRESS", startedAt: current.startedAt ?? now });
        await addSystemComment(tx, ticketId, actorRef, `[Trạng thái] ${user.name} đã bắt đầu xử lý (Đã phân loại → Đang xử lý).`);
        break;
      }
      case "close":
      case "cancel": {
        const nextStatus = input.action === "close" ? "CLOSED" : "CANCELLED";
        await guardedUpdate(tx, ticketId, expected, {
          status: nextStatus,
          closeReason: input.reason,
          resolutionNotes: input.description,
          resolvedAt: now,
          closedById: user.id,
        });
        await addSystemComment(
          tx,
          ticketId,
          actorRef,
          `[Trạng thái] ${user.name} đã ${input.action === "close" ? "đóng" : "hủy"} ticket — Lý do: ${input.reason}.`
        );
        resultSnapshot = { status: nextStatus, closeReason: input.reason, resolutionNotes: input.description };
        break;
      }
      case "reopen": {
        const reopenStatus = computeReopenStatus(current);
        await guardedUpdate(tx, ticketId, expected, {
          status: reopenStatus,
          closeReason: null,
          resolutionNotes: null,
          resolvedAt: null,
          closedById: null,
        });
        // Giữ lịch sử kết quả cũ trong comment nội bộ trước khi xóa khỏi ticket
        const history = [
          `[Mở lại] ${user.name} đã mở lại ticket (${ticketStatusLabel(current.status)} → ${ticketStatusLabel(reopenStatus)}).`,
          current.closeReason ? `Lý do trước đó: ${current.closeReason}.` : "",
          current.resolutionNotes ? `Mô tả kết quả trước đó:\n${current.resolutionNotes}` : "",
          input.note?.trim() ? `Ghi chú mở lại: ${input.note.trim()}` : "",
        ].filter(Boolean);
        await addSystemComment(tx, ticketId, actorRef, history.join("\n"));
        break;
      }
    }

    // Đủ điều kiện -> tự động chuyển (vd: xác nhận ưu tiên khi đã có dự án -> TRIAGED)
    const auto = await applyAutoStatusTransitions(tx, ticketId, actorRef);
    let status = auto.status;

    // "Nhận & bắt đầu xử lý": ticket đã phân loại -> chuyển luôn sang Đang xử lý
    if (input.action === "claim" && input.start && status === "TRIAGED") {
      await guardedUpdate(tx, ticketId, { status: "TRIAGED", assigneeId: user.id }, { status: "IN_PROGRESS", startedAt: current.startedAt ?? now });
      await addSystemComment(tx, ticketId, actorRef, `[Trạng thái] ${user.name} đã bắt đầu xử lý (Đã phân loại → Đang xử lý).`);
      status = "IN_PROGRESS";
    }
    return status;
  });

  publishTicketEvent({ type: "TICKET_UPDATED", ticketId, actorId: user.id }, projectIdForEvent);

  if (notifyAssigneeId) {
    notifyTicketAssignee(ticketId, notifyAssigneeId, user).catch((e) =>
      console.error("Lỗi gửi thông báo người xử lý ticket:", e)
    );
  }
  // Đóng / Hủy -> tự động gửi email kết quả cho khách hàng (lý do + mô tả lúc commit)
  if (resultSnapshot) {
    notifyCustomerAboutTicket({ ticketId, kind: "RESULT", staffName: user.name, snapshot: resultSnapshot });
  }

  return { status: finalStatus };
}

/** Thông báo in-app cho người được giao xử lý ticket */
export async function notifyTicketAssignee(ticketId: string, assigneeId: string, actor: Actor) {
  const t = await prisma.customerTicket.findUnique({
    where: { id: ticketId },
    select: { title: true, trackingCode: true, projectId: true },
  });
  if (!t) return;
  await sendNotification({
    userId: assigneeId,
    actorId: actor.id,
    type: "TICKET_UPDATED",
    title: `🎫 Bạn được giao xử lý ticket: ${t.title}`,
    message: `${actor.name} đã giao ticket "${t.trackingCode}" cho bạn xử lý.`,
    link: `/tickets?ticketId=${ticketId}`,
    projectId: t.projectId ?? undefined,
  });
}
