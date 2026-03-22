import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';

interface Drive {
  letter: string;
  label: string;
  total: number;
  free: number;
  type: 'system' | 'data' | 'cd';
}

@Component({
  selector: 'app-computer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './computer.component.html',
  styleUrl: './computer.component.css',
})
export class ComputerComponent {
  private readonly wm = inject(WindowManagerService);

  drives: Drive[] = [
    { letter: 'C:', label: 'OS', total: 500, free: 320, type: 'system' },
    { letter: 'D:', label: 'Data', total: 1000, free: 650, type: 'data' },
    { letter: 'E:', label: 'CD Drive', total: 0, free: 0, type: 'cd' },
  ];

  selectedDrive = signal<Drive | null>(null);

  selectDrive(drive: Drive): void {
    this.selectedDrive.set(drive);
  }

  openDrive(drive: Drive): void {
    if (drive.type === 'cd') return;
    this.wm.open({
      title: `${drive.letter}\\ (${drive.label})`,
      icon: '', x: 140, y: 100, width: 700, height: 500,
      component: 'documents',
      extra: { path: `${drive.letter}\\` },
    });
  }

  getUsedPercent(drive: Drive): number {
    if (drive.total === 0) return 0;
    return Math.round(((drive.total - drive.free) / drive.total) * 100);
  }

  formatSize(gb: number): string {
    return gb >= 1 ? `${gb} GB` : `${gb * 1024} MB`;
  }
}
