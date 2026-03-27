import { Injectable, signal } from '@angular/core';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  icon?: string;
  timestamp: Date;
  read: boolean;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  private _toasts = signal<Notification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly toasts = this._toasts.asReadonly();
  readonly unreadCount = () => this._notifications().filter(n => !n.read).length;

  show(
    title: string,
    message: string,
    type: NotificationType = 'info',
    duration = 5000,
    icon?: string
  ): void {
    const notification: Notification = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      icon,
      timestamp: new Date(),
      read: false,
      duration,
    };

    this._notifications.update(n => [notification, ...n].slice(0, 50));
    this._toasts.update(t => [...t, notification].slice(-4));

    setTimeout(() => this.dismissToast(notification.id), duration);
  }

  dismissToast(id: string): void {
    this._toasts.update(t => t.filter(n => n.id !== id));
  }

  markAllRead(): void {
    this._notifications.update(n => n.map(notif => ({ ...notif, read: true })));
  }

  clearAll(): void {
    this._notifications.set([]);
  }

  info(title: string, message: string): void {
    this.show(title, message, 'info');
  }

  success(title: string, message: string): void {
    this.show(title, message, 'success');
  }

  warning(title: string, message: string): void {
    this.show(title, message, 'warning');
  }

  error(title: string, message: string): void {
    this.show(title, message, 'error');
  }
}
