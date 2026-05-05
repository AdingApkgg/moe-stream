"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";
import { DashboardCommandPalette } from "./dashboard-command-palette";
import { useSidebarCollapsed } from "../_lib/use-dashboard-ui";

type Permissions = {
  role: "USER" | "ADMIN" | "OWNER";
  isOwner: boolean;
  isAdmin: boolean;
  scopes: string[];
  allScopes: Record<string, string>;
};

export function DashboardShell({ permissions, children }: { permissions: Permissions; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex flex-col h-full">
        {/* Topbar */}
        <DashboardTopbar
          permissions={permissions}
          pathname={pathname}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onToggleSidebar={toggleCollapsed}
          onOpenCommand={() => setCommandOpen(true)}
          sidebarCollapsed={collapsed}
        />

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside
            className={cn(
              "hidden lg:flex lg:flex-col border-r shrink-0 transition-[width] duration-200",
              collapsed ? "w-14" : "w-60",
            )}
          >
            <DashboardSidebar
              permissions={permissions}
              pathname={pathname}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
            />
          </aside>

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" showCloseButton={false} className="p-0 w-[86vw] max-w-[320px] sm:max-w-sm gap-0">
              <SheetHeader className="sr-only">
                <SheetTitle>管理面板导航</SheetTitle>
              </SheetHeader>
              <DashboardSidebar
                permissions={permissions}
                pathname={pathname}
                collapsed={false}
                variant="mobile"
                onItemClick={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Main */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-6 min-h-full">{children}</div>
          </main>
        </div>
      </div>

      {/* Command palette */}
      <DashboardCommandPalette open={commandOpen} onOpenChange={setCommandOpen} permissions={permissions} />
    </div>
  );
}
