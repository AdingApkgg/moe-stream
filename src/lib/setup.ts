import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getOrSet, deleteCache } from "@/lib/redis";

/**
 * Check if initial setup is complete (i.e., an OWNER user exists).
 * Cached in Redis for 5 minutes + React request-level cache.
 */
export const isSetupComplete = cache(async (): Promise<boolean> => {
  try {
    return await getOrSet(
      "setup:complete",
      async () => {
        const owner = await prisma.user.findFirst({
          where: { role: "OWNER" },
          select: { id: true },
        });
        return !!owner;
      },
      300
    );
  } catch {
    return false;
  }
});

export async function invalidateSetupCache() {
  await deleteCache("setup:complete");
}
