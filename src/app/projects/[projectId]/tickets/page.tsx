import { redirect } from "next/navigation";

// Ticket Khách Hàng đã tách thành module riêng (/tickets) — dự án chỉ còn là bộ lọc.
// Giữ route cũ để link/notification cũ (/projects/[id]/tickets?ticketId=...) vẫn mở đúng ticket.
export default async function ProjectTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, { ticketId }] = await Promise.all([params, searchParams]);

  const query = new URLSearchParams({ projectId });
  if (typeof ticketId === "string" && ticketId) query.set("ticketId", ticketId);
  redirect(`/tickets?${query.toString()}`);
}
