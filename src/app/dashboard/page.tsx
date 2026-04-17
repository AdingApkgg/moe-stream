"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

// 根据权限选择默认落地页：按常用程度依次 fallback
const FALLBACK_ROUTES: { scope: string; href: string }[] = [
  { scope: "stats:view", href: "/dashboard/stats" },
  { scope: "video:moderate", href: "/dashboard/videos" },
  { scope: "user:view", href: "/dashboard/users" },
  { scope: "comment:manage", href: "/dashboard/comments" },
  { scope: "tag:manage", href: "/dashboard/tags" },
  { scope: "referral:view_all", href: "/dashboard/referral-admin" },
  { scope: "settings:manage", href: "/dashboard/settings" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { data: permissions, isLoading } = trpc.admin.getMyPermissions.useQuery();

  useEffect(() => {
    if (isLoading || !permissions) return;
    // 非管理员 layout 已处理重定向
    if (!permissions.isAdmin && !permissions.isOwner) return;
    const target = FALLBACK_ROUTES.find((r) => permissions.scopes.includes(r.scope));
    router.replace(target?.href ?? "/");
  }, [permissions, isLoading, router]);

  return null;
}
