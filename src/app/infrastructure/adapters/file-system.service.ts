import { Injectable, signal, computed } from '@angular/core';

export interface FsFile {
  name: string;
  content: string;
  created: string;
  modified: string;
  size: number;
  type: 'file';
}

export interface FsDirectory {
  name: string;
  created: string;
  type: 'dir';
}

export interface RecycleBinItem {
  id: string;
  name: string;
  originalPath: string;
  content?: string;
  type: 'file' | 'dir';
  deletedAt: string;
  size: number;
}

export type FsEntry = FsFile | FsDirectory;

@Injectable({ providedIn: 'root' })
export class FileSystemService {
  private readonly STORAGE_KEY = 'win7_filesystem';

  private _tree = signal<Record<string, FsEntry[]>>(this.loadFromStorage());

  readonly tree = computed(() => this._tree());

  private loadFromStorage(): Record<string, FsEntry[]> {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return this.defaultTree();
  }

  private defaultTree(): Record<string, FsEntry[]> {
    const now = new Date().toISOString();
    return {
      'C:\\': [
        { name: 'Users', type: 'dir', created: now },
        { name: 'Windows', type: 'dir', created: now },
        { name: 'Program Files', type: 'dir', created: now },
      ],
      'C:\\Users': [{ name: 'User', type: 'dir', created: now }],
      'C:\\Users\\User': [
        { name: 'Documents', type: 'dir', created: now },
        { name: 'Desktop', type: 'dir', created: now },
        { name: 'Downloads', type: 'dir', created: now },
        { name: 'Pictures', type: 'dir', created: now },
        { name: 'Music', type: 'dir', created: now },
        { name: 'Videos', type: 'dir', created: now },
      ],
      'C:\\Users\\User\\Documents': [],
      'C:\\Users\\User\\Desktop': [],
      'C:\\Users\\User\\Downloads': [],
      'C:\\Users\\User\\Pictures': [],
      'C:\\Users\\User\\Music': [],
      'C:\\Users\\User\\Videos': [],
      'C:\\Windows': [
        { name: 'System32', type: 'dir', created: now },
        { name: 'Temp', type: 'dir', created: now },
      ],
      'C:\\Windows\\System32': [],
      'C:\\Windows\\Temp': [],
      'C:\\Program Files': [],
    };
  }

  private save(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._tree()));
  }

  private readonly RECYCLE_KEY = 'win7_recycle_bin';

  private loadRecycleBin(): RecycleBinItem[] {
    try {
      const saved = localStorage.getItem(this.RECYCLE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }

  private saveRecycleBin(items: RecycleBinItem[]): void {
    localStorage.setItem(this.RECYCLE_KEY, JSON.stringify(items));
  }

  getRecycleBin(): RecycleBinItem[] {
    return this.loadRecycleBin();
  }

  moveToRecycleBin(path: string, name: string): boolean {
    const entries = this.getEntries(path);
    const entry = entries.find(e => e.name === name);
    if (!entry) return false;

    const content = entry.type === 'file'
      ? localStorage.getItem(`notepad_${name}`) ?? ''
      : undefined;

    const item: RecycleBinItem = {
      id: crypto.randomUUID(),
      name,
      originalPath: path,
      content,
      type: entry.type,
      deletedAt: new Date().toISOString(),
      size: (entry as any).size || 0,
    };

    const bin = this.loadRecycleBin();
    bin.unshift(item);
    this.saveRecycleBin(bin);

    // Eliminar del filesystem
    this._tree.update(t => ({
      ...t,
      [path]: t[path].filter(e => e.name !== name),
    }));

    if (entry.type === 'file') {
      localStorage.removeItem(`notepad_${name}`);
    } else {
      this._tree.update(t => {
        const newTree = { ...t };
        delete newTree[`${path}\\${name}`];
        return newTree;
      });
    }

    this.save();
    return true;
  }

  restoreFromRecycleBin(id: string): boolean {
    const bin = this.loadRecycleBin();
    const item = bin.find(i => i.id === id);
    if (!item) return false;

    // Restaurar al filesystem
    if (item.type === 'file') {
      this.writeFile(item.originalPath, item.name, item.content || '');
    } else {
      this.createDir(item.originalPath, item.name);
    }

    // Quitar de la papelera
    this.saveRecycleBin(bin.filter(i => i.id !== id));
    return true;
  }

  emptyRecycleBin(): void {
    this.saveRecycleBin([]);
  }

  getRecycleBinCount(): number {
    return this.loadRecycleBin().length;
  }

  getEntries(path: string): FsEntry[] {
    return this._tree()[path] || [];
  }

  pathExists(path: string): boolean {
    return this._tree()[path] !== undefined;
  }

  fileExists(path: string, name: string): boolean {
    return this.getEntries(path).some(e => e.name === name);
  }

  createDir(path: string, name: string): boolean {
    const now = new Date().toISOString();
    const newPath = `${path}\\${name}`;
    if (this.pathExists(newPath)) return false;
    this._tree.update(t => ({
      ...t,
      [path]: [...(t[path] || []), { name, type: 'dir', created: now }],
      [newPath]: [],
    }));
    this.save();
    return true;
  }

  writeFile(path: string, name: string, content: string): void {
    const now = new Date().toISOString();
    const fullKey = `${path}\\${name}`;
    localStorage.setItem(`notepad_${name}`, content);
    this._tree.update(t => {
      const entries = t[path] || [];
      const existing = entries.findIndex(e => e.name === name);
      const newEntry: FsFile = {
        name,
        content,
        created: existing > -1 ? (entries[existing] as FsFile).created : now,
        modified: now,
        size: new Blob([content]).size,
        type: 'file',
      };
      const newEntries = existing > -1
        ? entries.map((e, i) => i === existing ? newEntry : e)
        : [...entries, newEntry];
      return { ...t, [path]: newEntries };
    });
    this.save();
  }

  readFile(path: string, name: string): string | null {
    const entry = this.getEntries(path).find(e => e.name === name) as FsFile;
    if (!entry || entry.type !== 'file') return null;
    return localStorage.getItem(`notepad_${name}`) ?? entry.content ?? null;
  }

  deleteEntry(path: string, name: string): boolean {
    const entries = this.getEntries(path);
    const entry = entries.find(e => e.name === name);
    if (!entry) return false;
    this._tree.update(t => {
      const newTree = { ...t, [path]: t[path].filter(e => e.name !== name) };
      if (entry.type === 'dir') delete newTree[`${path}\\${name}`];
      return newTree;
    });
    if (entry.type === 'file') localStorage.removeItem(`notepad_${name}`);
    this.save();
    return true;
  }

  renameEntry(path: string, oldName: string, newName: string): boolean {
    const entries = this.getEntries(path);
    const entry = entries.find(e => e.name === oldName);
    if (!entry) return false;
    this._tree.update(t => ({
      ...t,
      [path]: t[path].map(e => e.name === oldName ? { ...e, name: newName } : e),
    }));
    if (entry.type === 'file') {
      const content = localStorage.getItem(`notepad_${oldName}`) || '';
      localStorage.setItem(`notepad_${newName}`, content);
      localStorage.removeItem(`notepad_${oldName}`);
    }
    this.save();
    return true;
  }

  copyFile(srcPath: string, srcName: string, dstPath: string, dstName: string): boolean {
    const content = this.readFile(srcPath, srcName);
    if (content === null) return false;
    this.writeFile(dstPath, dstName, content);
    return true;
  }
}
