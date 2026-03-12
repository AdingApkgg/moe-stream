import type { Server, Socket } from "socket.io";

export function registerMessageHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("conversation:join", (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("conversation:leave", (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("typing:start", (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
      conversationId: data.conversationId,
      userId,
    });
  });

  socket.on("typing:stop", (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
      conversationId: data.conversationId,
      userId,
    });
  });
}
