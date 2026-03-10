import { getAuthWithOAuth } from "@/lib/auth";

async function handler(req: Request) {
  try {
    const auth = await getAuthWithOAuth();
    if (!auth) {
      console.error("[auth] Failed to initialize auth instance");
      return new Response(JSON.stringify({ error: "Auth initialization failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return await auth.handler(req);
  } catch (err) {
    const url = new URL(req.url);
    console.error(`[auth] Unhandled error on ${req.method} ${url.pathname}:`, err);
    return new Response(JSON.stringify({ error: "Internal auth error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
