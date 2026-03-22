import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';
import { WindowComponent } from '../../window-manager/components/window.component';
import { TaskbarComponent } from '../../taskbar/components/taskbar.component';
import { NotepadComponent } from '../../apps/notepad/notepad.component';
import { CalculatorComponent } from '../../apps/calculator/calculator.component';
import { CmdComponent } from '../../apps/cmd/cmd.component';
import { DocumentsComponent } from '../../apps/documents/documents.component';
import { ComputerComponent } from '../../apps/computer/computer.component';
import { ControlPanelComponent } from '../../apps/control-panel/control-panel.component';
import { FileSystemService, FsEntry, FsFile } from '../../../infrastructure/adapters/file-system.service';

@Component({
  selector: 'app-desktop',
  standalone: true,
  imports: [
    CommonModule,
    WindowComponent,
    TaskbarComponent,
    NotepadComponent,
    CalculatorComponent,
    CmdComponent,
    DocumentsComponent,
    ComputerComponent,
    ControlPanelComponent,
    ComputerComponent,
  ],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent {
  private readonly wm = inject(WindowManagerService);
  private readonly fs = inject(FileSystemService);

  readonly windows = this.wm.windows;
  readonly desktopEntries = computed(() => this.fs.getEntries('C:\\Users\\User\\Desktop'));

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

  openEntry(entry: FsEntry): void {
    if (entry.type === 'dir') {
      this.wm.open({
        title: entry.name,
        icon: '',
        x: 120,
        y: 90,
        width: 700,
        height: 500,
        component: 'documents',
        extra: { path: `C:\\Users\\User\\Desktop\\${entry.name}` },
      });
    } else {
      const file = entry as FsFile;
      const name = file.name.toLowerCase();
      if (name.endsWith('.txt') || name.endsWith('.log')) {
        this.wm.open({
          title: `${file.name} - Notepad`,
          icon: '',
          x: 100,
          y: 80,
          width: 600,
          height: 400,
          component: 'notepad',
          extra: { fileName: file.name, path: 'C:\\Users\\User\\Desktop' },
        });
      }
    }
  }

  getDesktopIconClass(entry: FsEntry): string {
    if (entry.type === 'dir') return 'icon folder-icon';
    const name = entry.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.log')) return 'icon notepad-icon';
    if (name.endsWith('.exe')) return 'icon exe-icon';
    return 'icon file-icon';
  }
}
