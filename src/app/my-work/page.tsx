import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getUserPermissionContext } from "@/lib/permissions-server";
import { canUserViewTicketModule } from "@/lib/ticket-access";
import { MyWorkView } from "./my-work-view";

export const dynamic = "force-dynamic";

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

  // Ưu tiên: 1. searchParams.projectId -> 2. Cookie flowboard_active_project -> 3. projects[0].id
  const { projectId: queryProjectId } = await searchParams;
  const cookieStore = await cookies();
  const cookieProjectId = cookieStore.get("flowboard_active_project")?.value;

  const targetId = typeof queryProjectId === "string" ? queryProjectId : cookieProjectId;
  const matchedProject = targetId
    ? projects.find((p) => p.id === targetId || p.key.toLowerCase() === targetId.toLowerCase())
    : null;

  const contextProjectId = matchedProject ? matchedProject.id : projects[0].id;

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
        <MyWorkView userId={user.id} />
      </AppShell>
    </PermissionsProvider>
  );
}
