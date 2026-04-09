"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { isPrivileged } from "@/lib/permissions";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
    passkeyClient(),
  ],
});

interface CustomSessionUser {
  role?: string;
  canUpload?: boolean;
  adsEnabled?: boolean;
  twoFactorEnabled?: boolean;
  groupId?: string | null;
  groupName?: string | null;
}

/**
 * 兼容原 next-auth useSession 的 hook：返回 { data, status }。
 * customSession 插件已在服务端注入 role/canUpload/adsEnabled，
 * cookie cache 会将这些字段传给客户端。
 */
export function useSession() {
  const { data, error, isPending, refetch } = authClient.useSession();
  const status = isPending ? "loading" : error || !data?.user ? "unauthenticated" : "authenticated";

  const customUser = data?.user as (NonNullable<typeof data>["user"] & CustomSessionUser) | undefined;
  const role = customUser?.role as "USER" | "ADMIN" | "OWNER" | undefined;
  const canUpload = isPrivileged(role ?? "") || customUser?.canUpload === true;
  const adsEnabled = customUser?.adsEnabled ?? true;
  const twoFactorEnabled = customUser?.twoFactorEnabled ?? false;

  const groupId = customUser?.groupId ?? null;
  const groupName = customUser?.groupName ?? null;

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
          twoFactorEnabled,
          groupId,
          groupName,
        },
        expires: data.session?.expiresAt?.toString?.() ?? "",
      }
    : null;
  return { data: session, status, update: refetch };
}
