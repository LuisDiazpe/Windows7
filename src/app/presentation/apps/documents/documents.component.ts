import { Component, inject, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemService, FsEntry, FsFile } from '../../../infrastructure/adapters/file-system.service';
import { WindowManagerService } from '../../../application/use-cases/window-manager/window-manager.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css',
})
export class DocumentsComponent {
  @Input() windowTitle?: string;
  @Input() set initialPath(path: string | undefined) {
    if (path) this.currentPath.set(path);
  }

  private readonly fs = inject(FileSystemService);
  private readonly wm = inject(WindowManagerService);

  currentPath = signal('C:\\Users\\User\\Documents');
  selectedEntry = signal<FsEntry | null>(null);
  showNewFolder = signal(false);
  newFolderName = signal('');
  contextMenu = signal<{ x: number; y: number; entry: FsEntry } | null>(null);

  readonly entries = computed(() => this.fs.getEntries(this.currentPath()));
  readonly pathParts = computed(() => {
    const parts = this.currentPath().split('\\');
    return parts.map((part, idx) => ({
      name: part,
      path: parts.slice(0, idx + 1).join('\\'),
    }));
  });

  openEntry(entry: FsEntry): void {
    if (entry.type === 'dir') {
      this.currentPath.set(`${this.currentPath()}\\${entry.name}`);
      this.selectedEntry.set(null);
    } else {
      this.openFileInNotepad(entry as FsFile);
    }
  }

  openFileInNotepad(file: FsFile): void {
    this.wm.open({
      title: `${file.name} - Notepad`,
      icon: '',
      x: 120,
      y: 90,
      width: 600,
      height: 400,
      component: 'notepad',
      extra: { fileName: file.name, path: this.currentPath() },
    });
  }

  navigateTo(path: string): void {
    this.currentPath.set(path);
    this.selectedEntry.set(null);
  }

  goUp(): void {
    const parts = this.currentPath().split('\\');
    if (parts.length > 1) {
      parts.pop();
      this.currentPath.set(parts.length === 1 ? parts[0] + '\\' : parts.join('\\'));
    }
  }

  selectEntry(event: MouseEvent, entry: FsEntry): void {
    event.stopPropagation();
    this.selectedEntry.set(entry);
    this.contextMenu.set(null);
  }

  onContextMenu(event: MouseEvent, entry: FsEntry): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.offsetX, y: event.offsetY, entry });
    this.selectedEntry.set(entry);
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  deleteSelected(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    if (confirm(`Are you sure you want to delete "${entry.name}"?`)) {
      this.fs.deleteEntry(this.currentPath(), entry.name);
      this.selectedEntry.set(null);
    }
    this.contextMenu.set(null);
  }

  renameSelected(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    const newName = prompt('Enter new name:', entry.name);
    if (newName && newName !== entry.name) {
      this.fs.renameEntry(this.currentPath(), entry.name, newName);
    }
    this.contextMenu.set(null);
  }

  createNewFolder(): void {
    const name = this.newFolderName().trim() || 'New Folder';
    this.fs.createDir(this.currentPath(), name);
    this.showNewFolder.set(false);
    this.newFolderName.set('');
  }

  createNewFile(): void {
    const name = prompt('File name:', 'New Text Document.txt');
    if (name) {
      this.fs.writeFile(this.currentPath(), name, '');
    }
  }

  getFileIcon(entry: FsEntry): string {
    if (entry.type === 'dir') return 'icon-folder';
    const name = entry.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.log')) return 'icon-txt';
    if (name.endsWith('.exe')) return 'icon-exe';
    if (name.endsWith('.bat') || name.endsWith('.cmd')) return 'icon-bat';
    return 'icon-file';
  }

  formatSize(entry: FsEntry): string {
    if (entry.type === 'dir') return '';
    const size = (entry as FsFile).size || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  formatDate(entry: FsEntry): string {
    const date = new Date((entry as any).modified || (entry as any).created);
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}
