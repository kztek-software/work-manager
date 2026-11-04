import { publish, TICKETS_ROOM, type BoardEvent } from "@/lib/bus";
import { prisma } from "@/lib/prisma";
import { TICKET_FINAL_STATUSES, TicketWorkflowError } from "@/lib/ticket-status";
import type { CustomerTicketDto, TicketCommentDto, AttachmentDto } from "@/lib/types";

// Quan hệ cần nạp kèm ticket (dùng chung list / chi tiết / tạo mới)
const TICKET_INCLUDE = {
  comments: { orderBy: { createdAt: "asc" as const } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  project: { select: { id: true, name: true, key: true } },
  convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
  assignee: { select: { id: true, name: true, avatarColor: true, title: true } },
};

export function generateTrackingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TK-${dateStr}-${random}`;
}

/**
 * Phát sự kiện ticket CHỈ vào TICKETS_ROOM (trang /tickets qua /api/tickets/stream).
 * Không phát vào room dự án: Board bỏ qua sự kiện TICKET_* và không có client nào khác
 * nghe ticket qua /api/projects/[id]/stream — tránh lộ id ticket cho thành viên không có tickets.view.
 */
export function publishTicketEvent(
  event: { type: Extract<BoardEvent["type"], "TICKET_CREATED" | "TICKET_UPDATED">; ticketId: string; actorId?: string },
  projectId: string | null | undefined,
  prevProjectId?: string | null
) {
  publish(TICKETS_ROOM, { ...event, projectId: projectId ?? null, prevProjectId: prevProjectId ?? null });
}

// Client Prisma dùng cho thao tác ticket: prisma mặc định hoặc tx trong $transaction
// (prisma dùng $extends nên lấy kiểu tx trực tiếp từ callback của prisma.$transaction)
export type TicketTx = Parameters<Extract<Parameters<typeof prisma.$transaction>[0], (...args: never[]) => unknown>>[0];
type TicketDb = TicketTx | typeof prisma;

// Tùy chọn khi gọi trong transaction: dùng tx và để caller tự phát sự kiện sau khi commit
type TicketWriteOptions = { db?: TicketDb; publishEvent?: boolean };

export type CreateTicketParams = {
  projectId?: string | null;
  actorId?: string;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  environment?: string | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number | null;
    mimeType?: string | null;
  }>;
};

export async function createTicket(params: CreateTicketParams): Promise<CustomerTicketDto> {
  let trackingCode = generateTrackingCode();
  
  // Ensure unique tracking code
  while (true) {
    const existing = await prisma.customerTicket.findUnique({ where: { trackingCode } });
    if (!existing) break;
    trackingCode = generateTrackingCode();
  }

  const created = await prisma.customerTicket.create({
    data: {
      trackingCode,
      projectId: params.projectId || null,
      title: params.title,
      description: params.description,
      type: params.type || "BUG",
      status: "OPEN",
      priority: params.priority || "MEDIUM",
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone || null,
      customerCompany: params.customerCompany || null,
      environment: params.environment || null,
      attachments: params.attachments && params.attachments.length > 0 ? {
        create: params.attachments.map(att => ({
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileType: att.fileType || "other",
          fileSize: att.fileSize || null,
          mimeType: att.mimeType || null,
        }))
      } : undefined,
    },
    include: TICKET_INCLUDE
  });

  publishTicketEvent(
    { type: "TICKET_CREATED", ticketId: created.id, actorId: params.actorId || "customer" },
    created.projectId
  );

  return formatPrismaTicket(created, false);
}

export async function getTicketByTrackingCode(trackingCode: string): Promise<CustomerTicketDto | null> {
  const row = await prisma.customerTicket.findFirst({
    where: { trackingCode: { equals: trackingCode } },
    include: {
      comments: { where: { isInternalOnly: false }, orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      project: { select: { id: true, name: true, key: true } },
      convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
    }
  });

  if (!row) return null;
  return formatPrismaTicket(row, false);
}

export async function getTicketById(id: string, includeInternal = true): Promise<CustomerTicketDto | null> {
  const row = await prisma.customerTicket.findUnique({
    where: { id },
    include: {
      comments: {
        where: includeInternal ? undefined : { isInternalOnly: false },
        orderBy: { createdAt: "asc" }
      },
      attachments: { orderBy: { createdAt: "asc" } },
      project: { select: { id: true, name: true, key: true } },
      convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
      assignee: { select: { id: true, name: true, avatarColor: true, title: true } },
    }
  });

  if (!row) return null;
  return formatPrismaTicket(row, includeInternal);
}

export type TicketStats = {
  total: number;
  open: number;
  acknowledged: number;
  triaged: number;
  inProgress: number;
  closed: number;
  cancelled: number;
  // Ticket chưa gán dự án (chỉ đếm cho người điều phối)
  unassigned: number;
  // Ticket đang chưa kết thúc mà user hiện tại là người xử lý
  mine: number;
};

/**
 * Danh sách ticket trong phạm vi xem của user.
 * - scopeWhere: điều kiện phạm vi (buildTicketScopeWhere) — bắt buộc truyền từ phía server.
 * - project: "ALL" | "UNASSIGNED" | projectId — bộ lọc dự án trong phạm vi đó.
 * - includeUnassignedCount: chỉ đếm ticket chưa gán cho người có tickets.assign.
 */
export async function getTickets(options: {
  scopeWhere: Record<string, unknown>;
  project?: string;
  status?: string;
  priority?: string;
  type?: string;
  search?: string;
  // Lọc người xử lý: "ALL" | "ME" | "NONE" (chưa có người xử lý) | userId
  assignee?: string;
  currentUserId?: string;
  includeUnassignedCount?: boolean;
}): Promise<{ tickets: CustomerTicketDto[]; stats: TicketStats }> {
  const project = options.project || "ALL";
  const projectWhere =
    project === "ALL" ? {} : project === "UNASSIGNED" ? { projectId: null } : { projectId: project };

  // Phạm vi + bộ lọc dự án: dùng chung cho danh sách và thống kê theo trạng thái
  const baseAnd: any[] = [options.scopeWhere, projectWhere];
  const listAnd: any[] = [...baseAnd];

  if (options.status && options.status !== "ALL") listAnd.push({ status: options.status });
  if (options.priority && options.priority !== "ALL") listAnd.push({ priority: options.priority });
  if (options.type && options.type !== "ALL") listAnd.push({ type: options.type });

  const assignee = options.assignee || "ALL";
  if (assignee === "ME") listAnd.push({ assigneeId: options.currentUserId ?? "__none__" });
  else if (assignee === "NONE") listAnd.push({ assigneeId: null });
  else if (assignee !== "ALL") listAnd.push({ assigneeId: assignee });

  if (options.search && options.search.trim()) {
    const term = options.search.trim();
    listAnd.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { trackingCode: { contains: term, mode: "insensitive" } },
        { customerName: { contains: term, mode: "insensitive" } },
        { customerEmail: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  const [rows, allStatusCounts, unassignedCount, mineCount] = await Promise.all([
    prisma.customerTicket.findMany({
      where: { AND: listAnd },
      orderBy: { createdAt: "desc" },
      include: TICKET_INCLUDE
    }),
    prisma.customerTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { AND: baseAnd },
    }),
    options.includeUnassignedCount
      ? prisma.customerTicket.count({ where: { projectId: null } })
      : Promise.resolve(0),
    options.currentUserId
      ? prisma.customerTicket.count({
          where: {
            AND: [
              ...baseAnd,
              { assigneeId: options.currentUserId, status: { notIn: [...TICKET_FINAL_STATUSES] } },
            ],
          },
        })
      : Promise.resolve(0),
  ]);

  const stats: TicketStats = {
    total: 0,
    open: 0,
    acknowledged: 0,
    triaged: 0,
    inProgress: 0,
    closed: 0,
    cancelled: 0,
    unassigned: unassignedCount,
    mine: mineCount,
  };

  for (const r of allStatusCounts) {
    const count = r._count._all;
    stats.total += count;
    if (r.status === "OPEN") stats.open = count;
    else if (r.status === "ACKNOWLEDGED") stats.acknowledged = count;
    else if (r.status === "TRIAGED") stats.triaged = count;
    else if (r.status === "IN_PROGRESS") stats.inProgress = count;
    else if (r.status === "CLOSED") stats.closed = count;
    else if (r.status === "CANCELLED") stats.cancelled = count;
  }

  const tickets = rows.map((r) => formatPrismaTicket(r, true));
  return { tickets, stats };
}

/**
 * Gán / đổi / bỏ gán (targetProjectId = null) dự án phụ trách của ticket.
 * Route gọi hàm này PHẢI kiểm tra quyền tickets.assign trước.
 */
export async function dispatchTicketToProject(params: {
  ticketId: string;
  targetProjectId: string | null;
  adminUser: { id: string; name: string };
}, options?: TicketWriteOptions): Promise<CustomerTicketDto | null> {
  const db = options?.db ?? prisma;
  const targetProject = params.targetProjectId
    ? await db.project.findUnique({
        where: { id: params.targetProjectId },
        select: { id: true, name: true, key: true },
      })
    : null;

  if (params.targetProjectId && !targetProject) throw new Error("Không tìm thấy dự án đích để điều phối");

  const current = await db.customerTicket.findUnique({
    where: { id: params.ticketId },
    select: { status: true, projectId: true },
  });
  if (!current) throw new Error("Không tìm thấy ticket cần điều phối");

  // Chỉ đổi dự án. Trạng thái & người xử lý (không còn hợp lệ ở dự án mới) do
  // applyAutoStatusTransitions (src/lib/ticket-workflow.ts) xử lý — caller PHẢI gọi sau hàm này.
  // Có điều kiện: ticket chưa Đóng / Hủy (request khác đóng đồng thời -> 409, transaction rollback)
  const moved = await db.customerTicket.updateMany({
    where: { id: params.ticketId, projectId: current.projectId, status: { notIn: [...TICKET_FINAL_STATUSES] } },
    data: {
      projectId: targetProject?.id ?? null,
    },
  });
  if (moved.count === 0) {
    throw new TicketWorkflowError(409, "Ticket vừa được đóng / hủy hoặc điều phối bởi người khác. Vui lòng tải lại.");
  }

  await addTicketComment({
    ticketId: params.ticketId,
    authorName: params.adminUser.name,
    isStaff: true,
    isInternalOnly: true,
    message: targetProject
      ? `[Điều phối hệ thống] ${params.adminUser.name} đã điều phối ticket này tới dự án ${targetProject.name} (${targetProject.key}).`
      : `[Điều phối hệ thống] ${params.adminUser.name} đã bỏ gán dự án của ticket này (chờ điều phối lại).`,
  }, { db, publishEvent: false });

  if (options?.publishEvent !== false) {
    publishTicketEvent(
      { type: "TICKET_UPDATED", ticketId: params.ticketId, actorId: params.adminUser.id },
      targetProject?.id ?? null,
      current.projectId
    );
  }

  // Trong transaction: dữ liệu chưa commit -> caller tự đọc lại sau khi commit
  return options?.db ? null : getTicketById(params.ticketId);
}

/**
 * Cập nhật các trường thông tin của ticket. KHÔNG đổi trạng thái / kết quả xử lý ở đây —
 * chuyển trạng thái đi qua src/lib/ticket-workflow.ts (server là nguồn sự thật).
 */
export async function updateTicket(
  id: string,
  data: {
    projectId?: string | null;
    type?: string;
    internalNotes?: string | null;
    convertedTaskId?: string | null;
  },
  actorId?: string,
  options?: TicketWriteOptions
): Promise<CustomerTicketDto | null> {
  const db = options?.db ?? prisma;
  const current = await db.customerTicket.findUnique({ where: { id }, select: { projectId: true } });
  if (!current) return null;

  await db.customerTicket.update({
    where: { id },
    data: {
      projectId: data.projectId !== undefined ? data.projectId : undefined,
      type: data.type,
      internalNotes: data.internalNotes !== undefined ? data.internalNotes : undefined,
      convertedTaskId: data.convertedTaskId !== undefined ? data.convertedTaskId : undefined,
    },
  });

  const finalProjectId = data.projectId !== undefined ? data.projectId : current.projectId;
  if (options?.publishEvent !== false) {
    publishTicketEvent(
      { type: "TICKET_UPDATED", ticketId: id, actorId: actorId || "staff" },
      finalProjectId,
      current.projectId !== finalProjectId ? current.projectId : null
    );
  }

  return options?.db ? null : getTicketById(id);
}

export async function addTicketComment(params: {
  ticketId: string;
  authorName: string;
  authorEmail?: string | null;
  isStaff?: boolean;
  isInternalOnly?: boolean;
  message: string;
  actorId?: string;
}, options?: TicketWriteOptions): Promise<TicketCommentDto> {
  // publishEvent = false khi caller tự phát sự kiện (vd: điều phối, transaction) để tránh bắn trùng
  const db = options?.db ?? prisma;
  const comment = await db.ticketComment.create({
    data: {
      ticketId: params.ticketId,
      authorName: params.authorName,
      authorEmail: params.authorEmail || null,
      isStaff: !!params.isStaff,
      isInternalOnly: !!params.isInternalOnly,
      message: params.message,
    }
  });

  // Touch ticket's updatedAt
  const ticket = await db.customerTicket.update({
    where: { id: params.ticketId },
    data: { updatedAt: new Date() },
    select: { projectId: true }
  });

  if (options?.publishEvent !== false) {
    publishTicketEvent(
      {
        type: "TICKET_UPDATED",
        ticketId: params.ticketId,
        actorId: params.actorId || (params.isStaff ? "staff" : "customer"),
      },
      ticket.projectId
    );
  }

  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    isStaff: comment.isStaff,
    isInternalOnly: comment.isInternalOnly,
    message: comment.message,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function getTicketComments(
  ticketId: string,
  includeInternal = true
): Promise<TicketCommentDto[]> {
  const rows = await prisma.ticketComment.findMany({
    where: {
      ticketId,
      isInternalOnly: includeInternal ? undefined : false,
    },
    orderBy: { createdAt: "asc" }
  });

  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    isStaff: r.isStaff,
    isInternalOnly: r.isInternalOnly,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function formatPrismaTicket(row: any, includeInternal: boolean): CustomerTicketDto {
  const comments: TicketCommentDto[] = (row.comments || []).map((c: any) => ({
    id: c.id,
    ticketId: c.ticketId,
    authorName: c.authorName,
    authorEmail: c.authorEmail,
    isStaff: Boolean(c.isStaff),
    isInternalOnly: Boolean(c.isInternalOnly),
    message: c.message,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  }));

  const attachments: AttachmentDto[] = (row.attachments || []).map((a: any) => ({
    id: a.id,
    ticketId: a.ticketId,
    taskId: a.taskId,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    fileType: a.fileType,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
  }));

  return {
    id: row.id,
    trackingCode: row.trackingCode,
    projectId: row.projectId,
    project: row.project,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    customerCompany: row.customerCompany,
    environment: row.environment,
    convertedTaskId: row.convertedTaskId,
    convertedTask: row.convertedTask,
    internalNotes: includeInternal ? row.internalNotes : undefined,
    resolutionNotes: row.resolutionNotes,
    resolvedAt: toIso(row.resolvedAt),
    // Luồng trạng thái mới (src/lib/ticket-status.ts)
    closeReason: row.closeReason ?? null,
    closedAt: toIso(row.resolvedAt),
    closedById: row.closedById ?? null,
    acknowledgedAt: toIso(row.acknowledgedAt),
    acknowledgedById: row.acknowledgedById ?? null,
    priorityConfirmedAt: toIso(row.priorityConfirmedAt),
    priorityConfirmedById: row.priorityConfirmedById ?? null,
    assigneeId: row.assigneeId ?? null,
    assignee: row.assignee ?? null,
    startedAt: toIso(row.startedAt),
    // Các mốc đã thực sự đi qua (stepper; an toàn để trả cho khách — chỉ là cờ)
    progress: {
      acknowledged: Boolean(row.acknowledgedAt) || (row.status !== "OPEN" && row.status !== "CANCELLED"),
      triaged:
        Boolean(row.projectId && row.priorityConfirmedAt) ||
        ["TRIAGED", "IN_PROGRESS", "CLOSED"].includes(row.status),
      started: Boolean(row.startedAt) || ["IN_PROGRESS", "CLOSED"].includes(row.status),
    },
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    comments,
    attachments,
    _count: { comments: comments.length },
  };
}

/**
 * Dữ liệu ticket an toàn để trả cho khách hàng (portal tra cứu):
 * bỏ dự án nội bộ, ghi chú nội bộ và task Kanban đã chuyển đổi.
 */
export function toPublicTicketDto(ticket: CustomerTicketDto): CustomerTicketDto {
  /* eslint-disable @typescript-eslint/no-unused-vars -- loại bỏ trường nội bộ khỏi object trả về */
  const {
    project,
    projectId,
    internalNotes,
    convertedTask,
    convertedTaskId,
    // Không lộ người xử lý / nhân viên nội bộ cho khách
    assignee,
    assigneeId,
    acknowledgedById,
    priorityConfirmedById,
    closedById,
    capabilities,
    ...rest
  } = ticket;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return {
    ...rest,
    // Không trả email người gửi (email nhân viên) cho khách
    comments: (ticket.comments || [])
      .filter((c) => !c.isInternalOnly)
      .map((c) => ({ ...c, authorEmail: null })),
  };
}
