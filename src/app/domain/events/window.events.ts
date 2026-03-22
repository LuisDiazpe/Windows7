export type WindowEventType =
  | 'WINDOW_OPENED'
  | 'WINDOW_CLOSED'
  | 'WINDOW_FOCUSED'
  | 'WINDOW_MINIMIZED'
  | 'WINDOW_MAXIMIZED'
  | 'WINDOW_RESTORED';

export interface WindowEvent {
  type: WindowEventType;
  windowId: string;
  timestamp: Date;
}
