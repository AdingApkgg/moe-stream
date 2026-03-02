import { getAuthWithOAuth } from "@/lib/auth";

async function handler(req: Request) {
  const auth = await getAuthWithOAuth();
  if (!auth) throw new Error("Failed to initialize auth");
  return auth.handler(req);
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
