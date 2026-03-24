import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, HostListener,
  AfterViewChecked, ViewChildren, QueryList, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';
import { WindowEntity } from '../../../domain/entities/window.entity';

type Tab = 'applications' | 'processes' | 'performance' | 'networking';

interface Process {
  name: string;
  pid: number;
  cpu: number;
  memory: number;
  status: string;
  username: string;
}

interface ContextMenu {
  x: number;
  y: number;
  win: WindowEntity;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-manager.component.html',
  styleUrl: './task-manager.component.css',
})
export class TaskManagerComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly wm = inject(WindowManagerService);
  @ViewChildren('perfGraph') perfGraphs!: QueryList<ElementRef<HTMLCanvasElement>>;

  activeTab = signal<Tab>('applications');
  selectedApp = signal<WindowEntity | null>(null);
  selectedProcess = signal<Process | null>(null);
  contextMenu = signal<ContextMenu | null>(null);

  readonly windows = this.wm.taskbarWindows;

  cpuHistory: number[] = Array(60).fill(0);
  ramHistory: number[] = Array(60).fill(0);
  cpuUsage = signal(0);
  ramUsage = signal(0);
  ramTotal = 8192;

  networkSent = signal(0);
  networkReceived = signal(0);
  networkHistory: { sent: number; recv: number }[] = Array(60).fill({ sent: 0, recv: 0 });

  private interval?: ReturnType<typeof setInterval>;

  readonly processes = signal<Process[]>([
    { name: 'System Idle Process', pid: 0, cpu: 0, memory: 24, status: 'Running', username: 'SYSTEM' },
    { name: 'System', pid: 4, cpu: 0, memory: 1432, status: 'Running', username: 'SYSTEM' },
    { name: 'smss.exe', pid: 344, cpu: 0, memory: 1192, status: 'Running', username: 'SYSTEM' },
    { name: 'csrss.exe', pid: 436, cpu: 0, memory: 4560, status: 'Running', username: 'SYSTEM' },
    { name: 'winlogon.exe', pid: 556, cpu: 0, memory: 5964, status: 'Running', username: 'SYSTEM' },
    { name: 'services.exe', pid: 616, cpu: 0, memory: 7400, status: 'Running', username: 'SYSTEM' },
    { name: 'lsass.exe', pid: 624, cpu: 0, memory: 9128, status: 'Running', username: 'SYSTEM' },
    { name: 'svchost.exe', pid: 776, cpu: 1, memory: 7016, status: 'Running', username: 'NETWORK SERVICE' },
    { name: 'svchost.exe', pid: 844, cpu: 0, memory: 5544, status: 'Running', username: 'LOCAL SERVICE' },
    { name: 'svchost.exe', pid: 920, cpu: 2, memory: 18240, status: 'Running', username: 'SYSTEM' },
    { name: 'dwm.exe', pid: 1512, cpu: 3, memory: 35816, status: 'Running', username: 'User' },
    { name: 'explorer.exe', pid: 1428, cpu: 1, memory: 42768, status: 'Running', username: 'User' },
    { name: 'taskbar.exe', pid: 1876, cpu: 0, memory: 12344, status: 'Running', username: 'User' },
    { name: 'audiodg.exe', pid: 2100, cpu: 1, memory: 8192, status: 'Running', username: 'LOCAL SERVICE' },
    { name: 'spoolsv.exe', pid: 2200, cpu: 0, memory: 6144, status: 'Running', username: 'SYSTEM' },
    { name: 'SearchIndexer.exe', pid: 2400, cpu: 2, memory: 24576, status: 'Running', username: 'SYSTEM' },
    { name: 'wmpnetwk.exe', pid: 2600, cpu: 0, memory: 4096, status: 'Running', username: 'NETWORK SERVICE' },
    { name: 'cmd.exe', pid: 2860, cpu: 0, memory: 4096, status: 'Running', username: 'User' },
    { name: 'taskmgr.exe', pid: 3200, cpu: 1, memory: 8192, status: 'Running', username: 'User' },
  ]);

  readonly totalCpu = computed(() =>
    this.processes().reduce((sum, p) => sum + p.cpu, 0)
  );

  readonly totalMemory = computed(() =>
    this.processes().reduce((sum, p) => sum + p.memory, 0)
  );

  readonly Math = Math;

  ngOnInit(): void {
    this.interval = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  ngAfterViewChecked(): void {
    if (this.activeTab() !== 'performance') return;
    const canvases = this.perfGraphs.toArray();
    if (canvases[0]) this.drawGraph(canvases[0].nativeElement, this.cpuHistory, '#00cc00');
    if (canvases[1]) this.drawGraph(canvases[1].nativeElement, this.ramHistory, '#4a90d9');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenu.set(null);
  }

  private tick(): void {
    const cpu = Math.max(2, Math.min(98, this.cpuUsage() + (Math.random() * 10 - 5)));
    this.cpuUsage.set(Math.round(cpu));
    this.cpuHistory = [...this.cpuHistory.slice(1), cpu];

    const ram = Math.max(30, Math.min(90, this.ramUsage() + (Math.random() * 4 - 2)));
    this.ramUsage.set(Math.round(ram));
    this.ramHistory = [...this.ramHistory.slice(1), ram];

    const sent = Math.floor(Math.random() * 50);
    const recv = Math.floor(Math.random() * 200);
    this.networkSent.set(sent);
    this.networkReceived.set(recv);
    this.networkHistory = [...this.networkHistory.slice(1), { sent, recv }];

    this.processes.update(procs => procs.map(p => ({
      ...p,
      cpu: p.pid === 0 ? 0 : Math.max(0, Math.min(99, p.cpu + Math.floor(Math.random() * 3 - 1))),
      memory: Math.max(100, p.memory + Math.floor(Math.random() * 200 - 100)),
    })));
  }

  // Context menu
  onRightClick(e: MouseEvent, win: WindowEntity): void {
    e.preventDefault();
    e.stopPropagation();
    this.selectedApp.set(win);
    this.contextMenu.set({ x: e.offsetX, y: e.offsetY, win });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  // Context menu actions
  ctxSwitchTo(win: WindowEntity): void {
    this.focusApp(win);
    this.closeContextMenu();
  }

  ctxEndTask(win: WindowEntity): void {
    this.endTask(win);
    this.closeContextMenu();
  }

  ctxDebug(win: WindowEntity): void {
    alert(`Attaching debugger to "${win.title}"...\nPID: ${Math.floor(Math.random() * 9000 + 1000)}\nDebugger not available in this environment.`);
    this.closeContextMenu();
  }

  ctxPerformanceMode(win: WindowEntity): void {
    alert(`Setting "${win.title}" to High Performance mode.\nPriority: Above Normal`);
    this.closeContextMenu();
  }

  ctxRestart(win: WindowEntity): void {
    const config = {
      title: win.title,
      icon: win.icon,
      x: win.x,
      y: win.y,
      width: win.width,
      height: win.height,
      component: win.component,
      extra: win.extra,
    };
    this.wm.close(win.id);
    setTimeout(() => this.wm.open(config), 300);
    this.closeContextMenu();
  }

  ctxGoToDetails(win: WindowEntity): void {
    this.activeTab.set('processes');
    this.closeContextMenu();
  }

  ctxOpenFileLocation(win: WindowEntity): void {
    const paths: Record<string, string> = {
      notepad: 'C:\\Windows\\System32\\notepad.exe',
      calculator: 'C:\\Windows\\System32\\calc.exe',
      cmd: 'C:\\Windows\\System32\\cmd.exe',
      paint: 'C:\\Windows\\System32\\mspaint.exe',
      taskmanager: 'C:\\Windows\\System32\\taskmgr.exe',
      documents: 'C:\\Windows\\explorer.exe',
      pictures: 'C:\\Windows\\explorer.exe',
      computer: 'C:\\Windows\\explorer.exe',
      controlpanel: 'C:\\Windows\\System32\\control.exe',
    };
    const path = paths[win.component] || 'C:\\Windows\\System32\\';
    alert(`File location:\n${path}`);
    this.closeContextMenu();
  }

  // App actions
  endTask(win: WindowEntity): void {
    this.wm.close(win.id);
    this.selectedApp.set(null);
  }

  endProcess(process: Process): void {
    if (process.username === 'SYSTEM') {
      alert('Access denied. You cannot end system processes.');
      return;
    }
    this.processes.update(procs => procs.filter(p => p.pid !== process.pid));
    this.selectedProcess.set(null);
  }

  focusApp(win: WindowEntity): void {
    this.wm.focus(win.id);
    this.wm.restore(win.id);
  }

  getAppStatus(win: WindowEntity): string {
    return win.state === 'minimized' ? 'Minimized' : 'Running';
  }

  formatMemory(kb: number): string {
    return kb.toLocaleString() + ' K';
  }

  getCpuColor(cpu: number): string {
    if (cpu > 70) return '#e05050';
    if (cpu > 40) return '#e09020';
    return '#1a7a1a';
  }

  drawGraph(canvas: HTMLCanvasElement, history: number[], color: string, max = 100): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0,180,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = (w / 6) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - (val / max) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }
}
