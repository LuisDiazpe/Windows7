import {
  Component, Input, Output, EventEmitter,
  inject, OnInit, signal, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowEntity } from '../../../domain/entities/window.entity';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';

@Component({
  selector: 'app-window',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="window"
      [class.focused]="window.isFocused"
      [class.maximized]="window.state === 'maximized'"
      [style.left.px]="window.state === 'maximized' ? 0 : posX()"
      [style.top.px]="window.state === 'maximized' ? 0 : posY()"
      [style.width.px]="window.state === 'maximized' ? screenW() : window.width"
      [style.height.px]="window.state === 'maximized' ? screenH() : window.height"
      [style.z-index]="window.zIndex"
      (mousedown)="onFocus()"
    >
      <div
        class="title-bar"
        [class.focused]="window.isFocused"
        (mousedown)="startDrag($event)"
        (dblclick)="onMaximize()"
      >
        <div class="title-bar-left">
          <img [src]="window.icon" class="title-icon" alt="" />
          <span class="title-text">{{ window.title }}</span>
        </div>
        <div class="title-bar-buttons">
          <button class="btn-minimize" (mousedown)="$event.stopPropagation()" (click)="onMinimize()">
            <span class="icon-minimize"></span>
          </button>
          <button class="btn-maximize" (mousedown)="$event.stopPropagation()" (click)="onMaximize()">
            <span class="icon-maximize"></span>
          </button>
          <button class="btn-close" (mousedown)="$event.stopPropagation()" (click)="onClose()">
            <span class="icon-close"></span>
          </button>
        </div>
      </div>

      <div class="window-content">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './window.component.css',
})
export class WindowComponent implements OnInit {
  @Input({ required: true }) window!: WindowEntity;

  private readonly wm = inject(WindowManagerService);

  posX = signal(0);
  posY = signal(0);
  screenW = signal(globalThis.innerWidth);
  screenH = signal(globalThis.innerHeight - 40);

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  ngOnInit(): void {
    this.posX.set(this.window.x);
    this.posY.set(this.window.y);
  }

  onFocus(): void { this.wm.focus(this.window.id); }
  onClose(): void { this.wm.close(this.window.id); }
  onMinimize(): void { this.wm.minimize(this.window.id); }

  onMaximize(): void {
    this.window.state === 'maximized'
      ? this.wm.restore(this.window.id)
      : this.wm.maximize(this.window.id);
  }

  startDrag(event: MouseEvent): void {
    if (this.window.state === 'maximized') return;
    this.dragging = true;
    this.dragOffsetX = event.clientX - this.posX();
    this.dragOffsetY = event.clientY - this.posY();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    const newX = event.clientX - this.dragOffsetX;
    const newY = Math.max(0, event.clientY - this.dragOffsetY);
    this.posX.set(newX);
    this.posY.set(newY);
    this.wm.updatePosition(this.window.id, newX, newY);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void { this.dragging = false; }
}
