import { EventEmitter } from 'events';
import type { NotificationRow } from './notification.service';

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function publishNotification(userId: string, notification: NotificationRow): void {
  bus.emit(`user:${userId}`, notification);
  bus.emit('broadcast', { userId, notification });
}

export function subscribeUserNotifications(
  userId: string,
  listener: (notification: NotificationRow) => void,
): () => void {
  const channel = `user:${userId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
