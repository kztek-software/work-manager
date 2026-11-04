export type BoardEvent = {
  type: "TASK_CHANGED" | "TASK_CREATED" | "TASK_DELETED" | "SPRINT_CHANGED" | "MEMBER_CHANGED" | "TICKET_CREATED" | "TICKET_UPDATED";
  taskId?: string;
  ticketId?: string;
  actorId?: string;
  // Sự kiện ticket: dự án hiện tại / dự án trước khi điều phối (để lọc quyền xem phía stream)
  projectId?: string | null;
  prevProjectId?: string | null;
  at: number;
};

// Kênh realtime riêng của module Ticket (/tickets) — nhận MỌI sự kiện ticket, kể cả ticket chưa gán dự án.
// Stream /api/tickets/stream tự lọc theo phạm vi xem của từng user trước khi gửi xuống client.
export const TICKETS_ROOM = "TICKETS";

type Listener = (event: BoardEvent) => void;

const globalForBus = globalThis as unknown as {
  boardBus?: Map<string, Set<Listener>>;
};

function getBus(): Map<string, Set<Listener>> {
  if (!globalForBus.boardBus) globalForBus.boardBus = new Map();
  return globalForBus.boardBus;
}

export function subscribe(projectId: string, listener: Listener): () => void {
  const bus = getBus();
  if (!bus.has(projectId)) bus.set(projectId, new Set());
  bus.get(projectId)!.add(listener);
  return () => {
    bus.get(projectId)?.delete(listener);
  };
}

export function publish(projectId: string, event: Omit<BoardEvent, "at">) {
  const bus = getBus();
  const listeners = bus.get(projectId);
  if (!listeners) return;
  const full: BoardEvent = { ...event, at: Date.now() };
  for (const listener of listeners) {
    try {
      listener(full);
    } catch {
      listeners.delete(listener);
    }
  }
}
