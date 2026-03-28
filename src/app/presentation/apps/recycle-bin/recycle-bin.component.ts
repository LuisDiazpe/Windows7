import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemService, RecycleBinItem } from '../../../infrastructure/adapters/file-system.service';
import { NotificationService } from '../../../infrastructure/state/notification.service';

@Component({
  selector: 'app-recycle-bin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recycle-bin.component.html',
  styleUrl: './recycle-bin.component.css',
})
export class RecycleBinComponent {
  private readonly fs = inject(FileSystemService);
  private readonly ns = inject(NotificationService);

  selectedId = signal<string | null>(null);
  contextMenu = signal<{ x: number; y: number; item: RecycleBinItem } | null>(null);

  readonly items = computed(() => this.fs.getRecycleBin());
  readonly isEmpty = computed(() => this.items().length === 0);
  readonly selectedItem = computed(() =>
    this.items().find(i => i.id === this.selectedId())
  );

  restore(item: RecycleBinItem): void {
    if (this.fs.restoreFromRecycleBin(item.id)) {
      this.ns.success('Restored', `"${item.name}" restored to ${item.originalPath}`);
      this.selectedId.set(null);
    }
  }

  restoreSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    const item = this.items().find(i => i.id === id);
    if (item) this.restore(item);
  }

  deleteSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    const item = this.items().find(i => i.id === id);
    if (!item) return;
    if (confirm(`Permanently delete "${item.name}"?`)) {
      const bin = this.fs.getRecycleBin().filter(i => i.id !== id);
      localStorage.setItem('win7_recycle_bin', JSON.stringify(bin));
      this.selectedId.set(null);
      this.ns.info('Deleted', `"${item.name}" permanently deleted`);
    }
  }

  emptyBin(): void {
    if (this.isEmpty()) return;
    if (confirm('Are you sure you want to permanently delete all items in the Recycle Bin?')) {
      this.fs.emptyRecycleBin();
      this.ns.info('Recycle Bin', 'Recycle Bin has been emptied');
    }
  }

  onRightClick(e: MouseEvent, item: RecycleBinItem): void {
    e.preventDefault();
    e.stopPropagation();
    this.selectedId.set(item.id);
    this.contextMenu.set({ x: e.offsetX, y: e.offsetY, item });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  getIcon(item: RecycleBinItem): string {
    if (item.type === 'dir') return 'icon-folder-deleted';
    const name = item.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.log')) return 'icon-txt-deleted';
    if (name.endsWith('.png') || name.endsWith('.jpg')) return 'icon-img-deleted';
    return 'icon-file-deleted';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  formatSize(size: number): string {
    if (size === 0) return '—';
    if (size < 1024) return `${size} B`;
    return `${(size / 1024).toFixed(1)} KB`;
  }
}
