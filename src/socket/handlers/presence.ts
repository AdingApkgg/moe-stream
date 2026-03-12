import type { Server, Socket } from "socket.io";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

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

const redis = new Redis(parseRedisUrl(REDIS_URL));
const ONLINE_TTL = 60;
const HEARTBEAT_INTERVAL = 30_000;

export function registerPresenceHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;
  const onlineKey = `online:${userId}`;

  redis.set(onlineKey, "1", "EX", ONLINE_TTL);
  io.emit("presence:online", { userId });

  const heartbeat = setInterval(() => {
    redis.set(onlineKey, "1", "EX", ONLINE_TTL);
  }, HEARTBEAT_INTERVAL);

  socket.on("disconnect", async () => {
    clearInterval(heartbeat);

    const rooms = await io.in(`user:${userId}`).fetchSockets();
    if (rooms.length === 0) {
      await redis.del(onlineKey);
      io.emit("presence:offline", { userId });
    }
  });

  socket.on("presence:check", async (data: { userIds: string[] }, callback) => {
    if (typeof callback !== "function") return;
    const pipeline = redis.pipeline();
    for (const uid of data.userIds.slice(0, 100)) {
      pipeline.exists(`online:${uid}`);
    }
    const results = await pipeline.exec();
    const online: Record<string, boolean> = {};
    data.userIds.slice(0, 100).forEach((uid, i) => {
      online[uid] = results?.[i]?.[1] === 1;
    });
    callback(online);
  });
}
