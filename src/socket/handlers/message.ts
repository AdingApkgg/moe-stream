import type { Server, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";

export function registerMessageHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("conversation:join", async (conversationId: string) => {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });
    if (!participant) return;
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("conversation:leave", (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("typing:start", (data: { conversationId: string }) => {
    if (!socket.rooms.has(`conversation:${data.conversationId}`)) return;
    socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
      conversationId: data.conversationId,
      userId,
    });
  });

  socket.on("typing:stop", (data: { conversationId: string }) => {
    if (!socket.rooms.has(`conversation:${data.conversationId}`)) return;
    socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
      conversationId: data.conversationId,
      userId,
    });
  });
}
