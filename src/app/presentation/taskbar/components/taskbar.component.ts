import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';
import { WindowEntity } from '../../../domain/entities/window.entity';
import { SystemSettingsService } from '../../../infrastructure/state/system-settings.service';

@Component({
  selector: 'app-taskbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './taskbar.component.html',
  styleUrl: './taskbar.component.css',
})
export class TaskbarComponent implements OnInit {
  private readonly wm = inject(WindowManagerService);

  readonly settings = inject(SystemSettingsService);
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

  openApp(app: string): void {
    this.closeStartMenu();

    const configs: Record<string, Omit<WindowEntity, 'id' | 'zIndex' | 'isFocused' | 'state'>> = {
      notepad: { title: 'Notepad', icon: '', x: 100, y: 80, width: 600, height: 400, component: 'notepad' },
      calculator: { title: 'Calculator', icon: '', x: 200, y: 120, width: 320, height: 480, component: 'calculator' },
      cmd: { title: 'Command Prompt', icon: '', x: 150, y: 100, width: 680, height: 400, component: 'cmd' },
      documents: { title: 'Documents', icon: '', x: 120, y: 90, width: 700, height: 500, component: 'documents', extra: { path: 'C:\\Users\\User\\Documents' } },
      pictures: { title: 'Pictures', icon: '', x: 140, y: 100, width: 700, height: 500, component: 'documents', extra: { path: 'C:\\Users\\User\\Pictures' } },
      computer: { title: 'Computer', icon: '', x: 160, y: 80, width: 700, height: 500, component: 'computer', extra: { path: 'C:\\' } },
      controlpanel: { title: 'Control Panel', icon: '', x: 180, y: 90, width: 700, height: 500, component: 'controlpanel' },
      paint: { title: 'Paint', icon: '', x: 80, y: 60, width: 900, height: 650, component: 'paint' },
    };

    const config = configs[app];
    if (config) this.wm.open(config);
  }

  shutdown(): void {
    this.closeStartMenu();
    document.body.style.transition = 'opacity 1s ease';
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.innerHTML = `
        <div style="
          width:100vw; height:100vh;
          background:#000;
          display:flex; align-items:center; justify-content:center;
          flex-direction:column; gap:16px;
        ">
          <div style="color:white; font-family:Segoe UI; font-size:18px;">
            Shutting down...
          </div>
        </div>
      `;
    }, 1000);
  }
}
