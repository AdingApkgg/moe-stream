"use client";

import { NotificationList } from "@/components/notifications/notification-list";
import { useStableSession } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { session, isLoading } = useStableSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session?.user) {
      router.push("/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session?.user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">通知中心</h1>
      </div>
      <div className="bg-card border rounded-xl overflow-hidden">
        <NotificationList />
      </div>
    </div>
  );
}
