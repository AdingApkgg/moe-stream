import type { Socket } from "socket.io";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]);
const prisma = new PrismaClient({ adapter });

/**
 * Socket.io auth middleware: extracts the Better Auth session cookie,
 * looks up the session in the database, and attaches user data.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const cookie = socket.handshake.headers.cookie;
    if (!cookie) return next(new Error("No cookie provided"));

    const sessionToken = extractSessionToken(cookie);
    if (!sessionToken) return next(new Error("No session token"));

    const session = await prisma.session.findFirst({
      where: {
        sessionToken,
        expires: { gt: new Date() },
      },
      select: { userId: true },
    });

    if (!session) return next(new Error("Invalid session"));

    socket.data.userId = session.userId;
    next();
  } catch (err) {
    console.error("[Socket.io Auth] Error:", err);
    next(new Error("Authentication failed"));
  }
}

function extractSessionToken(cookie: string): string | null {
  const cookieNames = [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
  ];

  for (const name of cookieNames) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}
