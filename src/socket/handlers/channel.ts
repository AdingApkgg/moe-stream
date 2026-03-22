import type { Server, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";

export function registerChannelHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("channel:join", async (channelId: string) => {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { type: true },
    });
    if (!channel) return;

    if (channel.type === "PRIVATE") {
      const membership = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { id: true },
      });
      if (!membership) return;
    }

    socket.join(`channel:${channelId}`);
  });

  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on("channel:typing:start", (data: { channelId: string }) => {
    if (!socket.rooms.has(`channel:${data.channelId}`)) return;
    socket.to(`channel:${data.channelId}`).emit("channel:typing:start", {
      channelId: data.channelId,
      userId,
    });
  });

  socket.on("channel:typing:stop", (data: { channelId: string }) => {
    if (!socket.rooms.has(`channel:${data.channelId}`)) return;
    socket.to(`channel:${data.channelId}`).emit("channel:typing:stop", {
      channelId: data.channelId,
      userId,
    });
  });
}
