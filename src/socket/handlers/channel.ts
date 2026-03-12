import type { Server, Socket } from "socket.io";

export function registerChannelHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("channel:join", (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on("channel:typing:start", (data: { channelId: string }) => {
    socket.to(`channel:${data.channelId}`).emit("channel:typing:start", {
      channelId: data.channelId,
      userId,
    });
  });

  socket.on("channel:typing:stop", (data: { channelId: string }) => {
    socket.to(`channel:${data.channelId}`).emit("channel:typing:stop", {
      channelId: data.channelId,
      userId,
    });
  });
}
