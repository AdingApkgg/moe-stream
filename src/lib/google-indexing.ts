import { SignJWT, importPKCS8 } from "jose";
import { getServerConfig } from "@/lib/server-config";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const config = await getServerConfig();
  const email = config.googleServiceAccountEmail;
  const privateKey = config.googlePrivateKey;

  if (!email || !privateKey) {
    return null;
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    const formattedKey = privateKey.replace(/\\n/g, "\n");
    const key = await importPKCS8(formattedKey, "RS256");

    const jwt = await new SignJWT({
      iss: email,
      scope: SCOPE,
      aud: GOOGLE_TOKEN_URL,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      console.error("Google OAuth 失败:", await response.text());
      return null;
    }

    const data = await response.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error("获取 Google access token 失败:", error);
    return null;
  }
}

export async function submitSitemapToGoogle(): Promise<boolean> {
  const token = await getAccessToken();
  const config = await getServerConfig();
  const appUrl = config.siteUrl;

  if (!token || !appUrl) {
    return false;
  }

  try {
    const siteUrl = encodeURIComponent(appUrl);
    const sitemapUrl = encodeURIComponent(`${appUrl}/sitemap.xml`);

    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/sitemaps/${sitemapUrl}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok || response.status === 204) {
      console.log("Google Search Console: Sitemap 提交成功");
      return true;
    } else {
      const error = await response.text();
      console.error(`Google Search Console 失败: ${error}`);
      return false;
    }
  } catch (error) {
    console.error("Google Search Console 出错:", error);
    return false;
  }
}

export async function isGoogleConfigured(): Promise<boolean> {
  const config = await getServerConfig();
  return !!(config.googleServiceAccountEmail && config.googlePrivateKey);
}
