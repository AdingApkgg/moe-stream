import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_SCOPES } from "@/lib/constants";
import { isOwner as isOwnerRole, isPrivileged } from "@/lib/permissions";
import { resolveAdminScopes, resolveRole } from "@/lib/group-permissions";
import { DashboardShell } from "./_components/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理后台",
  robots: {
    index: false, // 管理后台不索引
    follow: false,
    nocache: true,
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      adminScopes: true,
      group: { select: { role: true, adminScopes: true } },
    },
  });

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const effectiveRole = resolveRole(user.role, user.group?.role);
  const isOwner = isOwnerRole(effectiveRole);
  const isAdmin = isPrivileged(effectiveRole);

  if (!isAdmin && !isOwner) {
    redirect("/");
  }

  const groupAdminScopes = (user.group?.adminScopes as string[] | null) ?? null;
  const userAdminScopes = (user.adminScopes as string[] | null) ?? null;
  const scopes = resolveAdminScopes(effectiveRole, groupAdminScopes ?? userAdminScopes);

  const permissions = {
    role: effectiveRole,
    isOwner,
    isAdmin,
    scopes: scopes as string[],
    allScopes: ADMIN_SCOPES,
  };

  return <DashboardShell permissions={permissions}>{children}</DashboardShell>;
}
