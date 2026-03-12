import { getAuthWithOAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDeviceInfo } from "@/lib/device-info";
import { getIpLocation } from "@/lib/ip-location";

const OAUTH_CALLBACK_RE = /\/api\/auth\/callback\/([a-z]+)/;

/**
 * OAuth 回调成功后，异步写入 LoginSession 以记录设备/IP 信息。
 * 不阻塞主响应，失败静默忽略。
 */
function recordLoginSessionInBackground(req: Request, response: Response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;

  const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/);
  if (!tokenMatch) return;

  const sessionToken = decodeURIComponent(tokenMatch[1]);
  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  (async () => {
    try {
      const session = await prisma.session.findFirst({
        where: { sessionToken },
        select: { userId: true, sessionToken: true },
      });
      if (!session) return;

      const deviceInfo = parseDeviceInfo(userAgent);
      let ipv4Address: string | null = null;
      let ipv6Address: string | null = null;
      if (clientIp.includes(":")) {
        ipv6Address = clientIp;
      } else {
        ipv4Address = clientIp;
      }
      const ipv4Location = await getIpLocation(ipv4Address);
      const ipv6Location = await getIpLocation(ipv6Address);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.loginSession.upsert({
        where: { jti: session.sessionToken },
        create: {
          userId: session.userId,
          jti: session.sessionToken,
          deviceType: deviceInfo.deviceType,
          os: deviceInfo.os,
          osVersion: deviceInfo.osVersion,
          browser: deviceInfo.browser,
          browserVersion: deviceInfo.browserVersion,
          brand: deviceInfo.brand,
          model: deviceInfo.model,
          userAgent,
          fingerprint: null,
          ipv4Address,
          ipv4Location,
          ipv6Address,
          ipv6Location,
          expiresAt,
        },
        update: {
          lastActiveAt: new Date(),
          ipv4Address,
          ipv4Location,
          ipv6Address,
          ipv6Location,
        },
      });
    } catch (err) {
      console.error("[auth] Failed to record OAuth login session:", err);
    }
  })();
}

async function handler(req: Request) {
  let auth;
  try {
    auth = await getAuthWithOAuth();
  } catch (err) {
    console.error("[auth] Failed to initialize auth instance:", err);
    return new Response(
      JSON.stringify({ error: "Auth initialization failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const response = await auth.handler(req);

    const url = new URL(req.url);
    const callbackMatch = url.pathname.match(OAUTH_CALLBACK_RE);
    if (callbackMatch) {
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location") || "";
        if (location.includes("error=")) {
          console.error(`[auth] OAuth callback error redirect: ${location}`);
        } else {
          recordLoginSessionInBackground(req, response);
        }
      }
    }

    return response;
  } catch (err) {
    const url = new URL(req.url);
    console.error(
      `[auth] Unhandled error on ${req.method} ${url.pathname}:`,
      err,
    );

    if (url.pathname.match(OAUTH_CALLBACK_RE)) {
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", "OAuthCallbackError");
      return Response.redirect(loginUrl.toString(), 302);
    }

    return new Response(
      JSON.stringify({ error: "Internal auth error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
