"use client";

import { useSocket } from "@/hooks/use-socket";
import { useNotifications } from "@/hooks/use-notifications";
import { useStableSession } from "@/lib/hooks";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { session } = useStableSession();
  const userId = session?.user?.id;

  useSocket(userId);
  useNotifications(userId);

  return <>{children}</>;
}
