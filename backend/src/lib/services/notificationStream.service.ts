import { EventEmitter } from 'events';
import type { NotificationRow } from './notification.service';

const bus = new EventEmitter();
bus.setMaxListeners(50);

const activeConnections = new Map<string, number>();
const SSE_MAX_CONNECTIONS_PER_USER = 3;

export function publishNotification(userId: string, notification: NotificationRow): void {
  bus.emit(`user:${userId}`, notification);
  bus.emit('broadcast', { userId, notification });
}

export function subscribeUserNotifications(
  userId: string,
  listener: (notification: NotificationRow) => void,
): () => void {
  const channel = `user:${userId}`;
  
  // Rate limit: track connections per user
  const currentCount = activeConnections.get(userId) || 0;
  if (currentCount >= SSE_MAX_CONNECTIONS_PER_USER) {
    console.warn(`[SSE] Max connections reached for user ${userId}`);
    return () => {};
  }
  activeConnections.set(userId, currentCount + 1);
  
  bus.on(channel, listener);
  
  return () => {
    bus.off(channel, listener);
    const count = activeConnections.get(userId) || 1;
    if (count <= 1) {
      activeConnections.delete(userId);
    } else {
      activeConnections.set(userId, count - 1);
    }
  };
}
