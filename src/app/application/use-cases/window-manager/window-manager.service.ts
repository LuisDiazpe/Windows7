import { Injectable, signal, computed, inject } from '@angular/core';
import { NotificationService } from '../../../infrastructure/state/notification.service';
import { WindowEntity, WindowState } from '../../../domain/entities/window.entity';
import { WindowEvent } from '../../../domain/events/window.events';

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private readonly _windows = signal<WindowEntity[]>([]);
  private readonly _events = signal<WindowEvent[]>([]);
  private readonly ns = inject(NotificationService);
  private _zIndexCounter = 100;

  readonly windows = computed(() => this._windows());
  readonly focusedWindow = computed(() =>
    this._windows().find((w) => w.isFocused)
  );
  readonly openWindows = computed(() =>
    this._windows().filter((w) => w.state !== 'minimized')
  );
  readonly taskbarWindows = computed(() => this._windows());

  open(config: Omit<WindowEntity, 'id' | 'zIndex' | 'isFocused' | 'state'>): WindowEntity {
    const newWindow: WindowEntity = {
      ...config,
      id: crypto.randomUUID(),
      zIndex: ++this._zIndexCounter,
      isFocused: true,
      state: 'normal',
    };

    this._windows.update((wins) => [
      ...wins.map((w) => ({ ...w, isFocused: false })),
      newWindow,
    ]);

    this._emitEvent('WINDOW_OPENED', newWindow.id);
    this.ns.info(config.title, `${config.title} has been opened`);
    return newWindow;
  }

  close(id: string): void {
    const win = this._windows().find(w => w.id === id);
    this._windows.update((wins) => wins.filter((w) => w.id !== id));
    this._emitEvent('WINDOW_CLOSED', id);
    if (win) this.ns.info(win.title, `${win.title} has been closed`);
  }

  focus(id: string): void {
    this._windows.update((wins) =>
      wins.map((w) => ({
        ...w,
        isFocused: w.id === id,
        zIndex: w.id === id ? ++this._zIndexCounter : w.zIndex,
      }))
    );
    this._emitEvent('WINDOW_FOCUSED', id);
  }

  minimize(id: string): void {
    this._updateState(id, 'minimized');
    this._windows.update((wins) =>
      wins.map((w) => ({ ...w, isFocused: false }))
    );
    this._emitEvent('WINDOW_MINIMIZED', id);
  }

  maximize(id: string): void {
    this._updateState(id, 'maximized');
    this._emitEvent('WINDOW_MAXIMIZED', id);
  }

  restore(id: string): void {
    this._updateState(id, 'normal');
    this.focus(id);
    this._emitEvent('WINDOW_RESTORED', id);
  }

  updatePosition(id: string, x: number, y: number): void {
    this._windows.update((wins) =>
      wins.map((w) => (w.id === id ? { ...w, x, y } : w))
    );
  }

  updateSize(id: string, width: number, height: number): void {
    this._windows.update((wins) =>
      wins.map((w) => (w.id === id ? { ...w, width, height } : w))
    );
  }

  private _updateState(id: string, state: WindowState): void {
    this._windows.update((wins) =>
      wins.map((w) => (w.id === id ? { ...w, state } : w))
    );
  }

  private _emitEvent(type: WindowEvent['type'], windowId: string): void {
    this._events.update((events) => [
      ...events,
      { type, windowId, timestamp: new Date() },
    ]);
  }
}
