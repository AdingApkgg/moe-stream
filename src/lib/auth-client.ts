"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [usernameClient()],
});

interface CustomSessionUser {
  role?: string;
  canUpload?: boolean;
  adsEnabled?: boolean;
}

/**
 * 兼容原 next-auth useSession 的 hook：返回 { data, status }。
 * customSession 插件已在服务端注入 role/canUpload/adsEnabled，
 * cookie cache 会将这些字段传给客户端。
 */
export function useSession() {
  const { data, error, isPending, refetch } = authClient.useSession();
  const status = isPending ? "loading" : error || !data?.user ? "unauthenticated" : "authenticated";

  const customUser = data?.user as NonNullable<typeof data>["user"] & CustomSessionUser | undefined;
  const role = customUser?.role as "USER" | "ADMIN" | "OWNER" | undefined;
  const canUpload = role === "ADMIN" || role === "OWNER" || customUser?.canUpload === true;
  const adsEnabled = customUser?.adsEnabled ?? true;

  const session = data?.user
    ? {
        user: {
          id: data.user.id,
          email: data.user.email ?? "",
          name: data.user.name ?? null,
          image: data.user.image ?? null,
          role,
          canUpload,
          adsEnabled,
        },
        expires: data.session?.expiresAt?.toString?.() ?? "",
      }
    : null;
  return { data: session, status, update: refetch };
}
