import { Component, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notepad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notepad.component.html',
  styleUrl: './notepad.component.css',
})
export class NotepadComponent {
  content = signal('');
  savedContent = signal('');
  fileName = signal('Untitled');
  wordWrap = signal(true);
  showMenu = signal<string | null>(null);
  statusLine = signal(1);
  statusCol = signal(1);

  readonly isDirty = computed(() => this.content() !== this.savedContent());

  onContentChange(value: string): void {
    this.content.set(value);
  }

  onCursorMove(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split('\n');
    this.statusLine.set(lines.length);
    this.statusCol.set(lines[lines.length - 1].length + 1);
  }

  toggleMenu(menu: string): void {
    this.showMenu.set(this.showMenu() === menu ? null : menu);
  }

  closeMenus(): void {
    this.showMenu.set(null);
  }

  // File menu
  newFile(): void {
    if (this.isDirty()) {
      if (!confirm('Do you want to save changes to ' + this.fileName() + '?')) {
        this.content.set('');
        this.savedContent.set('');
        this.fileName.set('Untitled');
      }
    } else {
      this.content.set('');
      this.savedContent.set('');
      this.fileName.set('Untitled');
    }
    this.closeMenus();
  }

  saveFile(): void {
    const key = 'notepad_' + this.fileName();
    localStorage.setItem(key, this.content());
    this.savedContent.set(this.content());
    this.closeMenus();
  }

  saveAs(): void {
    const name = prompt('File name:', this.fileName());
    if (name) {
      this.fileName.set(name);
      this.saveFile();
    }
    this.closeMenus();
  }

  openFile(): void {
    const name = prompt('Open file (enter name):');
    if (name) {
      const content = localStorage.getItem('notepad_' + name);
      if (content !== null) {
        this.content.set(content);
        this.savedContent.set(content);
        this.fileName.set(name);
      } else {
        alert('File not found: ' + name);
      }
    }
    this.closeMenus();
  }

  // Edit menu
  selectAll(): void {
    const textarea = document.querySelector('.notepad-textarea') as HTMLTextAreaElement;
    textarea?.select();
    this.closeMenus();
  }

  cut(): void {
    const textarea = document.querySelector('.notepad-textarea') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      navigator.clipboard.writeText(textarea.value.substring(start, end));
      const newContent = textarea.value.substring(0, start) + textarea.value.substring(end);
      this.content.set(newContent);
    }
    this.closeMenus();
  }

  copy(): void {
    const textarea = document.querySelector('.notepad-textarea') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      navigator.clipboard.writeText(textarea.value.substring(start, end));
    }
    this.closeMenus();
  }

  paste(): void {
    navigator.clipboard.readText().then(text => {
      const textarea = document.querySelector('.notepad-textarea') as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = textarea.value.substring(0, start) + text + textarea.value.substring(end);
      this.content.set(newContent);
    });
    this.closeMenus();
  }

  toggleWordWrap(): void {
    this.wordWrap.update(v => !v);
    this.closeMenus();
  }

  insertDateTime(): void {
    const now = new Date().toLocaleString();
    const textarea = document.querySelector('.notepad-textarea') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const newContent = this.content().substring(0, start) + now + this.content().substring(start);
    this.content.set(newContent);
    this.closeMenus();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenus();
  }
}
