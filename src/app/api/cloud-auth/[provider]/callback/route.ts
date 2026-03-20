import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const TOKEN_TTL = 3600; // 1 hour

/**
 * OAuth callback for cloud providers (Google Drive, OneDrive).
 * Exchanges the authorization code for an access token and stores it in Redis.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error) {
    return redirectWithMessage("授权被取消或失败");
  }
  if (!code || !state) {
    return redirectWithMessage("缺少授权参数");
  }

  const userId = state;

  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "default" },
    });
    if (!config) return redirectWithMessage("站点配置不存在");

    const siteUrl = config.siteUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${siteUrl}/api/cloud-auth/${provider}/callback`;

    let accessToken: string;

    if (provider === "google") {
      const clientId = config.oauthGoogleClientId;
      const clientSecret = config.oauthGoogleClientSecret;
      if (!clientId || !clientSecret) return redirectWithMessage("Google OAuth 未配置");

      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error("Google token exchange failed:", body);
        return redirectWithMessage("Google 授权失败");
      }

      const data = (await resp.json()) as { access_token: string; expires_in?: number };
      accessToken = data.access_token;
    } else if (provider === "onedrive") {
      const clientId = config.oauthMicrosoftClientId;
      const clientSecret = config.oauthMicrosoftClientSecret;
      if (!clientId || !clientSecret) return redirectWithMessage("Microsoft OAuth 未配置");

      const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: "Files.Read.All offline_access",
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error("Microsoft token exchange failed:", body);
        return redirectWithMessage("Microsoft 授权失败");
      }

      const data = (await resp.json()) as { access_token: string };
      accessToken = data.access_token;
    } else {
      return redirectWithMessage("不支持的提供商");
    }

    await redis.set(`cloud:token:${userId}:${provider}`, accessToken, "EX", TOKEN_TTL);

    return NextResponse.redirect(new URL("/my-files?cloud_auth=success", siteUrl));
  } catch (err) {
    console.error("Cloud auth callback error:", err);
    return redirectWithMessage("授权处理失败");
  }
}

function redirectWithMessage(msg: string) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(
    new URL(`/my-files?cloud_auth_error=${encodeURIComponent(msg)}`, siteUrl),
  );
}
