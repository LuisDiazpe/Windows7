export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowEntity {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: WindowState;
  zIndex: number;
  isFocused: boolean;
  component: string;
}
