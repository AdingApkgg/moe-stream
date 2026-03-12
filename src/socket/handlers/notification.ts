import type { Server, Socket } from "socket.io";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerNotificationHandlers(_io: Server, _socket: Socket) {
  // Notifications are pushed from the tRPC side via Redis emitter.
  // This handler is reserved for client-initiated notification events
  // (e.g. marking all as read could trigger a badge update to other tabs).
}
