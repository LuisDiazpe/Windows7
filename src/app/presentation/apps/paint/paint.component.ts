import {
  Component, ElementRef, ViewChild, AfterViewInit,
  signal, HostListener
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileSystemService } from '../../../infrastructure/adapters/file-system.service';
import { inject } from '@angular/core';

type Tool = 'pencil' | 'eraser' | 'line' | 'rect' | 'circle' | 'fill' | 'eyedropper' | 'text';

@Component({
  selector: 'app-paint',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './paint.component.html',
  styleUrl: './paint.component.css',
})
export class PaintComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly Math = Math;

  tool = signal<Tool>('pencil');
  primaryColor = signal('#000000');
  secondaryColor = signal('#ffffff');
  brushSize = signal(3);
  cursorX = signal(0);
  cursorY = signal(0);
  showColorPicker = signal(false);
  pickingFor = signal<'primary' | 'secondary'>('primary');
  showMenu = signal<string | null>(null);
  canvasWidth = signal(800);
  canvasHeight = signal(520);

  // Text tool
  showTextInput = signal(false);
  textValue = signal('');
  textX = signal(0);
  textY = signal(0);
  fontSize = signal(18);
  fontFamily = signal('Arial');

  pastedImage: HTMLImageElement | null = null;
  pastedX = signal(0);
  pastedY = signal(0);
  pastedW = signal(0);
  pastedH = signal(0);
  isDraggingPaste = false;
  pasteDragOffsetX = 0;
  pasteDragOffsetY = 0;
  hasPastedImage = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private startX = 0;
  private startY = 0;
  private snapshot!: ImageData;
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private readonly MAX_UNDO = 20;
  private readonly fs = inject(FileSystemService);

  readonly colors = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
    '#ff8040', '#804000', '#80ff00', '#004040', '#0080ff', '#8000ff', '#ff0080', '#ff8080',
    '#ffcc99', '#ffd700', '#ccff99', '#99ffcc', '#99ccff', '#cc99ff', '#ff99cc', '#cccccc',
  ];

  readonly tools: { id: Tool; label: string; icon: string }[] = [
    { id: 'pencil', label: 'Pencil', icon: 'tool-pencil' },
    { id: 'eraser', label: 'Eraser', icon: 'tool-eraser' },
    { id: 'fill', label: 'Fill', icon: 'tool-fill' },
    { id: 'eyedropper', label: 'Color picker', icon: 'tool-eyedropper' },
    { id: 'line', label: 'Line', icon: 'tool-line' },
    { id: 'rect', label: 'Rectangle', icon: 'tool-rect' },
    { id: 'circle', label: 'Ellipse', icon: 'tool-circle' },
    { id: 'text', label: 'Text', icon: 'tool-text' },
  ];

  readonly brushSizes = [1, 2, 3, 5, 8, 12, 20];

  readonly canvasSizes = [
    { label: '400 × 300', w: 400, h: 300 },
    { label: '800 × 520', w: 800, h: 520 },
    { label: '1024 × 768', w: 1024, h: 768 },
    { label: '1280 × 960', w: 1280, h: 960 },
  ];

  readonly fontFamilies = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Impact'];

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.canvasWidth();
    canvas.height = this.canvasHeight();
    this.ctx = canvas.getContext('2d')!;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveUndo();
  }

  private saveUndo(): void {
    const canvas = this.canvasRef.nativeElement;
    this.undoStack.push(this.ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop()!);
    this.ctx.putImageData(this.undoStack[this.undoStack.length - 1], 0, 0);
  }

  redo(): void {
    if (!this.redoStack.length) return;
    const state = this.redoStack.pop()!;
    this.undoStack.push(state);
    this.ctx.putImageData(state, 0, 0);
  }

  resizing = false;
  resizeDir = '';
  resizeStartX = 0;
  resizeStartY = 0;
  resizeStartW = 0;
  resizeStartH = 0;

  startCanvasResize(e: MouseEvent, dir: string): void {
    e.stopPropagation();
    e.preventDefault();
    this.resizing = true;
    this.resizeDir = dir;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.resizeStartW = this.canvasWidth();
    this.resizeStartH = this.canvasHeight();

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - this.resizeStartX;
      const dy = ev.clientY - this.resizeStartY;
      let newW = this.resizeStartW;
      let newH = this.resizeStartH;
      if (dir.includes('e')) newW = Math.max(100, this.resizeStartW + dx);
      if (dir.includes('s')) newH = Math.max(100, this.resizeStartH + dy);
      if (dir.includes('se')) { newW = Math.max(100, this.resizeStartW + dx); newH = Math.max(100, this.resizeStartH + dy); }
      this.resizeCanvas(Math.round(newW), Math.round(newH));
    };

    const onUp = () => {
      this.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
    if (e.ctrlKey && e.key === 'v') { e.preventDefault(); this.pasteFromClipboard(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.saveImage(); }
    if (e.ctrlKey && e.key === 'a') { e.preventDefault(); this.selectAll(); }
  }

  toggleMenu(menu: string, e: MouseEvent): void {
    e.stopPropagation();
    this.showMenu.set(this.showMenu() === menu ? null : menu);
  }

  closeMenus(): void { this.showMenu.set(null); }

  @HostListener('document:click')
  onDocumentClick(): void { this.closeMenus(); }

  getPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const scaleX = this.canvasRef.nativeElement.width / rect.width;
    const scaleY = this.canvasRef.nativeElement.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  onMouseDown(e: MouseEvent): void {
    const { x, y } = this.getPos(e);
    const isRight = e.button === 2;
    const color = isRight ? this.secondaryColor() : this.primaryColor();

    // Si hay imagen pegada, verificar si se hace click dentro
    if (this.hasPastedImage()) {
      const px = this.pastedX(), py = this.pastedY();
      const pw = this.pastedW(), ph = this.pastedH();
      if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
        this.isDraggingPaste = true;
        this.pasteDragOffsetX = x - px;
        this.pasteDragOffsetY = y - py;
        return;
      } else {
        // Click fuera — commit la imagen y continúa
        this.commitPaste();
      }
    }

    // resto del código original...
    if (this.tool() === 'text') {
      this.textX.set(x);
      this.textY.set(y);
      this.showTextInput.set(true);
      return;
    }

    if (this.tool() === 'eyedropper') {
      const pixel = this.ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      if (isRight) this.secondaryColor.set(hex);
      else this.primaryColor.set(hex);
      return;
    }

    if (this.tool() === 'fill') {
      this.floodFill(x, y, color);
      this.saveUndo();
      return;
    }

    this.drawing = true;
    this.startX = x;
    this.startY = y;

    const canvas = this.canvasRef.nativeElement;
    this.snapshot = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    this.ctx.strokeStyle = this.tool() === 'eraser' ? this.secondaryColor() : color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = this.brushSize();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (this.tool() === 'pencil' || this.tool() === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }
  }

  onMouseMove(e: MouseEvent): void {
    const { x, y } = this.getPos(e);
    this.cursorX.set(x);
    this.cursorY.set(y);
    if (this.isDraggingPaste && this.hasPastedImage()) {
      this.pastedX.set(x - this.pasteDragOffsetX);
      this.pastedY.set(y - this.pasteDragOffsetY);
      this.drawWithPaste();
      return;
    }

    if (!this.drawing) return;

    const isRight = e.buttons === 2;

    switch (this.tool()) {
      case 'pencil':
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'eraser':
        this.ctx.strokeStyle = this.secondaryColor();
        this.ctx.lineWidth = this.brushSize() * 2;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'line':
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'rect':
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.strokeRect(this.startX, this.startY, x - this.startX, y - this.startY);
        break;
      case 'circle':
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.beginPath();
        this.ctx.ellipse(
          (this.startX + x) / 2, (this.startY + y) / 2,
          Math.abs(x - this.startX) / 2, Math.abs(y - this.startY) / 2,
          0, 0, Math.PI * 2
        );
        this.ctx.stroke();
        break;
    }
  }

  onMouseUp(e: MouseEvent): void {
    if (this.isDraggingPaste) {
      this.isDraggingPaste = false;
      return;
    }
    if (!this.drawing) return;
    this.drawing = false;
    this.saveUndo();
    // Snapshot actualizado para que paste siga funcionando
    const canvas = this.canvasRef.nativeElement;
    this.snapshot = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  onRightClick(e: MouseEvent): boolean {
    e.preventDefault();
    return false;
  }

  placeText(): void {
    if (!this.textValue().trim()) { this.showTextInput.set(false); return; }
    this.ctx.font = `${this.fontSize()}px ${this.fontFamily()}`;
    this.ctx.fillStyle = this.primaryColor();
    this.ctx.fillText(this.textValue(), this.textX(), this.textY());
    this.textValue.set('');
    this.showTextInput.set(false);
    this.saveUndo();
  }

  cancelText(): void {
    this.textValue.set('');
    this.showTextInput.set(false);
  }

  private floodFill(startX: number, startY: number, fillColor: string): void {
    const canvas = this.canvasRef.nativeElement;
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const startIdx = (startY * canvas.width + startX) * 4;
    const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];
    const fillR = parseInt(fillColor.slice(1, 3), 16);
    const fillG = parseInt(fillColor.slice(3, 5), 16);
    const fillB = parseInt(fillColor.slice(5, 7), 16);
    if (startR === fillR && startG === fillG && startB === fillB) return;
    const match = (idx: number) =>
      Math.abs(data[idx] - startR) < 32 && Math.abs(data[idx + 1] - startG) < 32 &&
      Math.abs(data[idx + 2] - startB) < 32 && Math.abs(data[idx + 3] - startA) < 32;
    const stack = [[startX, startY]];
    const visited = new Set<number>();
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      const idx = (y * canvas.width + x) * 4;
      if (visited.has(idx) || !match(idx)) continue;
      visited.add(idx);
      data[idx] = fillR; data[idx + 1] = fillG; data[idx + 2] = fillB; data[idx + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    this.ctx.putImageData(imageData, 0, 0);
  }

  clearCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = this.secondaryColor();
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveUndo();
  }

  saveImage(): void {
    const canvas = this.canvasRef.nativeElement;
    const name = prompt('Save as:', 'drawing.png') || 'drawing.png';
    const finalName = name.endsWith('.png') ? name : name + '.png';

    // Guardar en Pictures via FileSystemService
    canvas.toBlob(blob => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.fs.writeFile('C:\\Users\\User\\Pictures', finalName, base64);
      };
      reader.readAsDataURL(blob);
    }, 'image/png');

    // También descargar el archivo
    const link = document.createElement('a');
    link.download = finalName;
    link.href = canvas.toDataURL();
    link.click();
  }

  selectAll(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.strokeStyle = '#0080ff';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(0, 0, canvas.width, canvas.height);
    this.ctx.setLineDash([]);
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            this.pastedImage = img;
            this.pastedX.set(10);
            this.pastedY.set(10);
            this.pastedW.set(img.width);
            this.pastedH.set(img.height);
            this.hasPastedImage.set(true);
            this.drawWithPaste();
            URL.revokeObjectURL(url);
          };
          img.src = url;
          return;
        }
      }
    } catch {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.textValue.set(text);
          this.textX.set(10);
          this.textY.set(30);
          this.showTextInput.set(true);
        }
      } catch {}
    }
  }

  drawWithPaste(): void {
    if (!this.pastedImage || !this.snapshot) return;
    this.ctx.putImageData(this.snapshot, 0, 0);
    this.ctx.drawImage(this.pastedImage, this.pastedX(), this.pastedY(), this.pastedW(), this.pastedH());

    // Dibujar borde de selección
    this.ctx.strokeStyle = '#0080ff';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(this.pastedX() - 1, this.pastedY() - 1, this.pastedW() + 2, this.pastedH() + 2);
    this.ctx.setLineDash([]);
  }

  commitPaste(): void {
    if (!this.hasPastedImage()) return;
    this.saveUndo();
    this.hasPastedImage.set(false);
    this.pastedImage = null;
  }

  resizeCanvas(w: number, h: number): void {
    const canvas = this.canvasRef.nativeElement;
    const snapshot = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = w;
    canvas.height = h;
    this.canvasWidth.set(w);
    this.canvasHeight.set(h);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.putImageData(snapshot, 0, 0);
    this.saveUndo();
  }

  openColorPicker(for_: 'primary' | 'secondary'): void {
    this.pickingFor.set(for_);
    this.showColorPicker.set(true);
  }

  swapColors(): void {
    const tmp = this.primaryColor();
    this.primaryColor.set(this.secondaryColor());
    this.secondaryColor.set(tmp);
  }
}
