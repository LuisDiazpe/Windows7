import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';
import { WindowComponent } from '../../window-manager/components/window.component';
import { TaskbarComponent } from '../../taskbar/components/taskbar.component';

@Component({
  selector: 'app-desktop',
  standalone: true,
  imports: [CommonModule, WindowComponent, TaskbarComponent],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent {
  private readonly wm = inject(WindowManagerService);

  readonly windows = this.wm.windows;

  openNotepad(): void {
    this.wm.open({
      title: 'Notepad',
      icon: '',
      x: 100,
      y: 80,
      width: 600,
      height: 400,
      component: 'notepad',
    });
  }

  openCalculator(): void {
    this.wm.open({
      title: 'Calculator',
      icon: '',
      x: 200,
      y: 120,
      width: 320,
      height: 480,
      component: 'calculator',
    });
  }

  openCmd(): void {
    this.wm.open({
      title: 'Command Prompt',
      icon: '',
      x: 150,
      y: 100,
      width: 680,
      height: 400,
      component: 'cmd',
    });
  }
}
