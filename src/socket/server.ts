import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { authenticateSocket } from "./auth";
import { registerNotificationHandlers } from "./handlers/notification";
import { registerMessageHandlers } from "./handlers/message";
import { registerChannelHandlers } from "./handlers/channel";
import { registerPresenceHandlers } from "./handlers/presence";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  };
}

const redisOpts = parseRedisUrl(REDIS_URL);
const pubClient = new Redis(redisOpts);
const subClient = pubClient.duplicate();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    credentials: true,
  },
  adapter: createAdapter(pubClient, subClient),
});

io.use(authenticateSocket);

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;

  socket.join(`user:${userId}`);

  registerNotificationHandlers(io, socket);
  registerMessageHandlers(io, socket);
  registerChannelHandlers(io, socket);
  registerPresenceHandlers(io, socket);

  console.log(`[Socket.io] User connected: ${userId} (${socket.id})`);

  socket.on("disconnect", () => {
    console.log(`[Socket.io] User disconnected: ${userId} (${socket.id})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Socket.io] Server listening on port ${PORT}`);
});
