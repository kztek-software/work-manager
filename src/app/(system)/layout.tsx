import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getUserPermissionContext } from "@/lib/permissions-server";
import { canUserViewTicketModule } from "@/lib/ticket-access";
import { ActiveProjectProvider } from "@/lib/active-project-context";

export const dynamic = "force-dynamic";

/**
 * Nhóm "Hệ thống & Tích hợp" (không gắn với 1 dự án): /all-projects, /users, /settings, /notion.
 * Sidebar vẫn cần 1 "dự án ngữ cảnh" — lấy theo cookie flowboard_active_project (dự án đang chọn
 * gần nhất), mặc định dự án đầu tiên user tham gia.
 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

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
  if (projectRows.length === 0) redirect("/welcome");

  const projects = projectRows.map(({ id, name, key, status }) => ({ id, name, key, status }));
  const memberProjectIds = projectRows.filter((p) => p.members.length > 0).map((p) => p.id);

  const cookieStore = await cookies();
  const cookieProjectId = cookieStore.get("flowboard_active_project")?.value;
  const contextProjectId =
    (cookieProjectId && projects.find((p) => p.id === cookieProjectId)?.id) ||
    memberProjectIds[0] ||
    projects[0].id;

  const [contextProject, permCtx, canViewTickets] = await Promise.all([
    prisma.project.findUnique({
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
    }),
    getUserPermissionContext(user.id, contextProjectId, user.role),
    canUserViewTicketModule(user),
  ]);
  if (!contextProject) redirect("/");

  return (
    <PermissionsProvider
      projectId={contextProject.id}
      initialPermissions={permCtx.permissions}
      initialRole={permCtx.role}
      initialProjectRole={permCtx.projectRole}
      initialIsAdmin={permCtx.isAdmin}
      initialIsOwner={permCtx.isOwner}
      initialCanCreateProject={permCtx.canCreateProject}
    >
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
        canViewTickets={canViewTickets}
      >
        <ActiveProjectProvider projectId={contextProject.id}>{children}</ActiveProjectProvider>
      </AppShell>
    </PermissionsProvider>
  );
}
