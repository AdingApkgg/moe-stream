import { prisma } from "./prisma";
import { socketEmitter } from "./socket-emitter";
import type { NotificationType } from "@/generated/prisma/client";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      content: params.content,
      data: params.data,
    },
  });

  socketEmitter
    .to(`user:${params.userId}`)
    .emit("notification:new", notification);

  return notification;
}

export async function createBulkNotifications(
  notifications: CreateNotificationParams[],
) {
  if (notifications.length === 0) return;

  const created = await prisma.$transaction(
    notifications.map((n) =>
      prisma.notification.create({
        data: {
          userId: n.userId,
          type: n.type,
          title: n.title,
          content: n.content,
          data: n.data,
        },
      }),
    ),
  );

  for (const notification of created) {
    socketEmitter
      .to(`user:${notification.userId}`)
      .emit("notification:new", notification);
  }

  return created;
}
