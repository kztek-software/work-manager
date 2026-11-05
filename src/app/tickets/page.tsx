import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getUserPermissionContext } from "@/lib/permissions-server";
import { getTicketById, getTickets } from "@/lib/tickets";
import {
  buildTicketScopeWhere,
  canCreateTickets,
  canUseTicketModule,
  findAccessibleTicket,
  getTicketAccess,
  getTicketCapabilities,
  getTicketProjectOptions,
} from "@/lib/ticket-access";
import { acknowledgeTicketOnView } from "@/lib/ticket-workflow";
import { TicketListView } from "@/components/tickets/ticket-list-view";

export const dynamic = "force-dynamic";

/**
 * Module Ticket Khách Hàng (không gắn với 1 dự án): /tickets?projectId=ALL|UNASSIGNED|<id|key>&ticketId=<id>
 * Dự án chỉ là thuộc tính/bộ lọc của ticket. Phạm vi xem theo src/lib/ticket-access.ts.
 * Sidebar vẫn cần 1 "dự án ngữ cảnh" — lấy dự án đang lọc nếu có, mặc định dự án đầu tiên user tham gia.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const access = await getTicketAccess(user);
  if (!canUseTicketModule(access)) redirect("/");

  const projectRows = await prisma.project.findMany({
    where: user.role === "ADMIN" ? undefined : { members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      key: true,
      status: true,
      members: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const projects = projectRows.map(({ id, name, key, status }) => ({ id, name, key, status }));
  const memberProjectIds = projectRows.filter((p) => p.members.length > 0).map((p) => p.id);

  const { projectId: projectQuery, ticketId: ticketQuery } = await searchParams;
  // Người điều phối: mọi dự án trong hệ thống (kể cả dự án không tham gia)
  const projectOptions = await getTicketProjectOptions(access);

  // Chuẩn hóa bộ lọc dự án: chấp nhận id hoặc key; UNASSIGNED chỉ dành cho người điều phối
  const rawProject = typeof projectQuery === "string" ? projectQuery.trim() : "";
  const matchedProject = rawProject
    ? projectOptions.find((p) => p.id === rawProject || p.key.toUpperCase() === rawProject.toUpperCase())
    : undefined;
  const projectFilter =
    rawProject.toUpperCase() === "UNASSIGNED" && access.canAssign
      ? "UNASSIGNED"
      : matchedProject?.id ?? "ALL";

  // Người điều phối không thuộc dự án nào vẫn vào được: dự án ngữ cảnh của sidebar lấy từ danh sách
  // mọi dự án; hệ thống chưa có dự án nào -> hiển thị trang không kèm AppShell.
  const contextProjectId: string | null =
    (matchedProject && projects.find((p) => p.id === matchedProject.id)?.id) ||
    memberProjectIds[0] ||
    projects[0]?.id ||
    (access.canAssign ? matchedProject?.id || projectOptions[0]?.id : undefined) ||
    null;
  if (!contextProjectId && !access.canAssign) redirect("/welcome");

  const ticketIdParam = typeof ticketQuery === "string" ? ticketQuery.trim() : "";

  const [contextProject, permCtx, ticketData, openTicketRow] = await Promise.all([
    contextProjectId ? prisma.project.findUnique({
      where: { id: contextProjectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
                title: true,
                team: { select: { id: true, name: true, code: true, color: true } },
              },
            },
          },
        },
      },
    }) : Promise.resolve(null),
    getUserPermissionContext(user.id, contextProjectId, user.role),
    getTickets({
      scopeWhere: buildTicketScopeWhere(access),
      project: projectFilter,
      currentUserId: user.id,
      includeUnassignedCount: access.canAssign,
    }),
    ticketIdParam ? findAccessibleTicket(access, ticketIdParam) : Promise.resolve(null),
  ]);
  if (!contextProject && !access.canAssign) redirect("/");

  // Mở sẵn chi tiết ticket (link thông báo / ?ticketId=) cũng tính là nhân viên đã xem -> Mới → Đã tiếp nhận.
  // CẢNH BÁO: đây là side effect khi server render. Link tới /tickets?ticketId=... được <Link> prefetch
  // (hover/viewport) có thể vô tình tiếp nhận ticket dù nhân viên chưa mở. Link kiểu này nên đặt
  // prefetch={false}; nếu cần chặt chẽ hơn thì chuyển việc ack sang client (GET /api/tickets/[id] khi drawer mở).
  if (openTicketRow?.status === "OPEN") {
    await acknowledgeTicketOnView(openTicketRow.id, { id: user.id, name: user.name });
  }
  const openTicket = openTicketRow ? await getTicketById(openTicketRow.id, true) : null;

  // key: điều hướng thật tới ?projectId= / ?ticketId= khác (vd: bấm thông báo khi đang ở /tickets) -> khởi tạo lại state
  const listView = (
    <TicketListView
      key={`${projectFilter}|${openTicket?.id ?? ""}`}
      projects={projectOptions}
      canAssign={access.canAssign}
      canCreate={canCreateTickets(access)}
      initialProjectFilter={projectFilter}
      initialTicket={
        openTicket && { ...openTicket, capabilities: getTicketCapabilities(access, openTicket) }
      }
      initialTickets={ticketData.tickets.map((t) => ({
        ...t,
        capabilities: getTicketCapabilities(access, t),
      }))}
      initialStats={ticketData.stats}
      currentUserId={user.id}
    />
  );

  return (
    <PermissionsProvider
      projectId={contextProject?.id}
      initialPermissions={permCtx.permissions}
      initialRole={permCtx.role}
      initialProjectRole={permCtx.projectRole}
      initialIsAdmin={permCtx.isAdmin}
      initialIsOwner={permCtx.isOwner}
      initialCanCreateProject={permCtx.canCreateProject}
    >
      {contextProject ? (
        <AppShell
          user={user}
          project={{
            id: contextProject.id,
            name: contextProject.name,
            key: contextProject.key,
            status: contextProject.status,
            members: contextProject.members.map((m) => ({
              id: m.id,
              role: m.role,
              user: m.user,
            })),
          }}
          projects={projects}
          canViewTickets
        >
          {listView}
        </AppShell>
      ) : (
        <div className="h-screen flex flex-col">{listView}</div>
      )}
    </PermissionsProvider>
  );
}
