import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';
import { WindowEntity } from '../../../domain/entities/window.entity';

@Component({
  selector: 'app-taskbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './taskbar.component.html',
  styleUrl: './taskbar.component.css',
})
export class TaskbarComponent implements OnInit {
  private readonly wm = inject(WindowManagerService);

  readonly windows = this.wm.taskbarWindows;
  readonly time = signal('');
  readonly date = signal('');
  showStartMenu = signal(false);

  ngOnInit(): void {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  updateClock(): void {
    const now = new Date();
    this.time.set(now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }));
    this.date.set(now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }));
  }

  onWindowClick(win: WindowEntity): void {
    if (win.state === 'minimized') {
      this.wm.restore(win.id);
    } else if (win.isFocused) {
      this.wm.minimize(win.id);
    } else {
      this.wm.focus(win.id);
    }
  }

  toggleStartMenu(): void {
    this.showStartMenu.update(v => !v);
  }

  closeStartMenu(): void {
    this.showStartMenu.set(false);
  }
}
