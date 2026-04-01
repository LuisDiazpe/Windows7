import {
  Component, signal, computed, Input, Output, EventEmitter,
  ElementRef, ViewChild, AfterViewInit, HostListener, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArduinoBoard, BoardModel, BoardPin, BOARDS } from './models/arduino-board.model';
import {
  EmulatorComponent, ComponentTemplate, ComponentType,
  COMPONENT_TEMPLATES
} from './models/arduino-component.model';

interface SerialEntry {
  text: string;
  type: 'output' | 'input' | 'info' | 'error';
}

interface Wire {
  id: string;
  fromComponentId: string;
  fromPin: string;
  toPin: number;
  color: string;
  points: { x: number; y: number }[];
}

@Component({
  selector: 'app-arduino-emulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arduino-emulator.component.html',
  styleUrl: './arduino-emulator.component.css',
})
export class ArduinoEmulatorComponent implements AfterViewInit {

  @Input() code = '';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  // Board
  selectedBoard = signal<BoardModel>('uno');
  board = computed(() => ({
    ...BOARDS[this.selectedBoard()],
    pins: BOARDS[this.selectedBoard()].pins.map(p => ({ ...p }))
  }));

  // Components on canvas
  components = signal<EmulatorComponent[]>([]);
  componentStates = signal<Record<string, Record<string, any>>>({});
  wires = signal<Wire[]>([]);
  selectedComponentId = signal<string | null>(null);

  private readonly STORAGE_KEY = 'arduino_emulator_state';
  // Drag state
  draggingComponent: EmulatorComponent | null = null;
  draggingFromPanel: ComponentTemplate | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  // Wire drawing
  drawingWire = signal(false);
  wireStart: { componentId: string; pinName: string; x: number; y: number } | null = null;
  mousePos = signal({ x: 0, y: 0 });

  // Serial monitor
  serialOutput = signal<SerialEntry[]>([]);
  serialInput = signal('');
  isRunning = signal(false);
  simulationInterval: any = null;

  // Pin connection modal
  showPinModal = signal(false);
  pendingConnection: { componentId: string; pinName: string } | null = null;
  selectedPinNumber = signal<number | null>(null);

  readonly boards: { model: BoardModel; label: string }[] = [
    { model: 'uno', label: 'Arduino Uno' },
    { model: 'mega', label: 'Arduino Mega' },
    { model: 'nano', label: 'Arduino Nano' },
    { model: 'esp32', label: 'ESP32' },
    { model: 'esp32nano', label: 'ESP32 Nano' },
  ];

  readonly templatesByCategory = computed(() => {
    const cats: Record<string, ComponentTemplate[]> = {
      output: [], input: [], power: [], communication: [],
    };
    COMPONENT_TEMPLATES.forEach(t => cats[t.category].push(t));
    return cats;
  });

  readonly categoryLabels: Record<string, string> = {
    output: 'Salida',
    input: 'Entrada',
    power: 'Alimentación',
    communication: 'Comunicación',
  };

  private tickCount = 0;
  private pinStates: Record<number, number> = {};
  private variables: Record<string, any> = {};
  private pinModes: Record<number, 'input' | 'output'> = {};



  ngAfterViewInit(): void {
    this.addLog('info', '🔌 Emulador Arduino listo');
    this.addLog('info', `📋 Placa: ${this.board().label}`);
    this.loadState();
  }

  //Board
  changeBoard(model: BoardModel): void {
    this.selectedBoard.set(model);
    this.components.set([]);
    this.componentStates.set({});
    this.wires.set([]);
    this.serialOutput.set([]);
    this.addLog('info', `📋 Placa cambiada a: ${this.board().label}`);
    this.saveState();
  }

  //Drag from panel
  onPanelDragStart(e: DragEvent, template: ComponentTemplate): void {
    this.draggingFromPanel = template;
    e.dataTransfer?.setData('text/plain', template.type);
  }

  onCanvasDragOver(e: DragEvent): void {
    e.preventDefault();
  }

  onCanvasDrop(e: DragEvent): void {
    e.preventDefault();
    if (!this.draggingFromPanel) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left - this.draggingFromPanel.width / 2;
    const y = e.clientY - rect.top - this.draggingFromPanel.height / 2;

    const newComponent: EmulatorComponent = {
      id: crypto.randomUUID(),
      type: this.draggingFromPanel.type,
      label: this.draggingFromPanel.label,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: this.draggingFromPanel.width,
      height: this.draggingFromPanel.height,
      pins: this.draggingFromPanel.pins.map(p => ({ ...p, connectedTo: null })),
      state: { ...this.draggingFromPanel.defaultState },
      color: this.getDefaultColor(this.draggingFromPanel.type),
    };

    this.components.update(cs => [...cs, newComponent]);
    this.componentStates.update(states => ({
      ...states,
      [newComponent.id]: { ...newComponent.state }
    }));
    this.draggingFromPanel = null;
    this.addLog('info', `➕ ${newComponent.label} agregado al canvas`);
    this.saveState();
  }

  //Drag component on canvas
  onComponentMouseDown(e: MouseEvent, comp: EmulatorComponent): void {
    if ((e.target as HTMLElement).classList.contains('pin-dot')) return;
    e.stopPropagation();
    this.selectedComponentId.set(comp.id);
    this.draggingComponent = comp;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left - comp.x;
    this.dragOffsetY = e.clientY - rect.top - comp.y;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.canvasRef) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this.mousePos.set({ x: mx, y: my });

    if (this.draggingComponent) {
      const newX = Math.max(0, mx - this.dragOffsetX);
      const newY = Math.max(0, my - this.dragOffsetY);
      this.components.update(cs =>
        cs.map(c => c.id === this.draggingComponent!.id
          ? { ...c, x: newX, y: newY } : c)
      );
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    this.draggingComponent = null;
  }

  //Pin connection
  onPinClick(e: MouseEvent, comp: EmulatorComponent, pinName: string): void {
    e.stopPropagation();
    this.pendingConnection = { componentId: comp.id, pinName };
    this.showPinModal.set(true);
  }

  confirmPinConnection(): void {
    const pin = this.selectedPinNumber();
    if (pin === null || !this.pendingConnection) return;

    const pinNumber = Number(pin);
    const { componentId, pinName } = this.pendingConnection;

    this.components.update(cs =>
      cs.map(c => {
        if (c.id !== componentId) return c;
        return {
          ...c,
          pins: c.pins.map(p =>
            p.name === pinName ? { ...p, connectedTo: pinNumber } : p
          ),
        };
      })
    );

    this.addLog('info', `🔗 Pin ${pinName} conectado al pin ${pinNumber} de la placa`);
    this.showPinModal.set(false);
    this.pendingConnection = null;
    this.selectedPinNumber.set(null);
    this.saveState();
  }

  disconnectPin(comp: EmulatorComponent, pinName: string): void {
    this.components.update(cs =>
      cs.map(c => {
        if (c.id !== comp.id) return c;
        return {
          ...c,
          pins: c.pins.map(p =>
            p.name === pinName ? { ...p, connectedTo: null } : p
          ),
        };
      })
    );
    this.saveState();
  }

  deleteComponent(id: string): void {
    this.components.update(cs => cs.filter(c => c.id !== id));
    this.componentStates.update(states => {
      const copy = { ...states };
      delete copy[id];
      return copy;
    });
    if (this.selectedComponentId() === id) {
      this.selectedComponentId.set(null);
    }
    this.saveState();
  }

  //Simulation
  startSimulation(): void {
    if (this.isRunning()) return;
    if (!this.code.trim()) {
      this.addLog('error', '❌ No hay código para ejecutar');
      return;
    }

    this.isRunning.set(true);
    this.serialOutput.set([]);
    this.pinStates = {};
    this.pinModes = {};
    this.variables = {};
    this.tickCount = 0;

    this.addLog('info', '▶ Iniciando simulación...');
    this.addLog('info', '─'.repeat(40));

    // Ejecutar async sin bloquear el UI
    this.runArduinoCode(this.code).catch(e => {
      this.addLog('error', `❌ Error: ${e.message}`);
      this.stopSimulation();
    });
  }

  stopSimulation(): void {
    this.isRunning.set(false);
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.addLog('info', '⏹ Simulación detenida');
  }

  //Arduino execution engine
  private async runArduinoCode(code: string): Promise<void> {
    this.extractGlobalVariables(code);

    const setupBody = this.extractFunctionBody(code, 'setup');
    const loopBody = this.extractFunctionBody(code, 'loop');

    if (!setupBody && !loopBody) {
      this.addLog('error', '❌ No se encontró setup() ni loop()');
      this.stopSimulation();
      return;
    }

    if (setupBody) {
      this.addLog('info', 'Ejecutando setup()...');
      await this.executeArduinoBlockAsync(setupBody);
    }

    if (loopBody) {
      while (this.isRunning() && this.tickCount < 10000) {
        await this.executeArduinoBlockAsync(loopBody);
        this.tickCount++;
        // Pequeña pausa entre iteraciones para no bloquear el UI
        await this.sleep(10);
      }
      if (this.tickCount >= 10000) {
        this.addLog('info', '⏹ Loop detenido (límite alcanzado)');
      }
      this.stopSimulation();
    } else {
      this.stopSimulation();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private saveState(): void {
    try {
      const state = {
        board: this.selectedBoard(),
        components: this.components(),
        componentStates: this.componentStates(),
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('No se pudo guardar estado del emulador', e);
    }
  }

  private loadState(): void {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.board) this.selectedBoard.set(state.board);
      if (state.components?.length) {
        this.components.set(state.components);
        this.componentStates.set(state.componentStates || {});
        this.addLog('info', `♻️ ${state.components.length} componentes restaurados`);
      }
    } catch (e) {
      console.warn('No se pudo cargar estado del emulador', e);
    }
  }

  clearAll(): void {
    this.components.set([]);
    this.componentStates.set({});
    this.wires.set([]);
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.addLog('info', '🗑️ Canvas limpiado');
  }

  private async executeArduinoBlockAsync(code: string): Promise<void> {
    if (!this.isRunning()) return;

    // Tokenizar respetando bloques {}
    const statements = this.tokenizeBlock(code);

    for (const stmt of statements) {
      if (!this.isRunning()) return;
      await this.executeStatementAsync(stmt);
    }
  }

  private tokenizeBlock(code: string): string[] {
    const statements: string[] = [];
    let current = '';
    let depth = 0;
    let i = 0;

    while (i < code.length) {
      const ch = code[i];
      if (ch === '{') {
        depth++;
        current += ch;
      } else if (ch === '}') {
        depth--;
        current += ch;
        if (depth === 0) {
          statements.push(current.trim());
          current = '';
        }
      } else if (ch === ';' && depth === 0) {
        current += ch;
        if (current.trim()) statements.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
      i++;
    }
    if (current.trim()) statements.push(current.trim());
    return statements.filter(s => s.length > 0);
  }

  private async executeStatementAsync(stmt: string): Promise<void> {
    if (!this.isRunning()) return;
    stmt = stmt.trim();

    // if/else
    if (/^if\s*\(/.test(stmt)) {
      await this.executeIfAsync(stmt);
      return;
    }

    // while
    if (/^while\s*\(/.test(stmt)) {
      await this.executeWhileAsync(stmt);
      return;
    }

    // for
    if (/^for\s*\(/.test(stmt)) {
      await this.executeForAsync(stmt);
      return;
    }

    // delay — async real
    if (/^delay\s*\(/.test(stmt)) {
      const match = stmt.match(/delay\s*\((.+?)\)/);
      if (match) {
        const ms = Number(this.evalArduinoExpr(match[1]));
        this.addLog('info', `⏱ delay(${ms}ms)`);
        this.cdr.detectChanges();
        await this.sleep(ms);
      }
      return;
    }

    // Línea normal
    this.executeArduinoLine(stmt);
    this.cdr.detectChanges();
  }

  private async executeIfAsync(stmt: string): Promise<void> {
    // Extraer condición
    const condMatch = stmt.match(/^if\s*\((.+?)\)\s*/);
    if (!condMatch) return;

    const condition = this.evalCondition(condMatch[1]);
    const rest = stmt.slice(condMatch[0].length).trim();

    // Extraer bloque if
    let ifBlock = '';
    let elseBlock = '';

    if (rest.startsWith('{')) {
      const closeIdx = this.findMatchingBrace(rest, 0);
      ifBlock = rest.slice(1, closeIdx);
      const afterIf = rest.slice(closeIdx + 1).trim();

      if (afterIf.startsWith('else')) {
        const elseRest = afterIf.slice(4).trim();
        if (elseRest.startsWith('{')) {
          const elseClose = this.findMatchingBrace(elseRest, 0);
          elseBlock = elseRest.slice(1, elseClose);
        } else {
          elseBlock = elseRest;
        }
      }
    } else {
      // Single line if
      ifBlock = rest.split(';')[0] + ';';
    }

    if (condition) {
      await this.executeArduinoBlockAsync(ifBlock);
    } else if (elseBlock) {
      await this.executeArduinoBlockAsync(elseBlock);
    }
  }

  private async executeWhileAsync(stmt: string): Promise<void> {
    const match = stmt.match(/^while\s*\((.+?)\)\s*\{([\s\S]*)\}/);
    if (!match) return;

    let iterations = 0;
    while (this.isRunning() && this.evalCondition(match[1]) && iterations < 10000) {
      await this.executeArduinoBlockAsync(match[2]);
      iterations++;
    }
  }

  private async executeForAsync(stmt: string): Promise<void> {
    const match = stmt.match(/^for\s*\((.+?);(.+?);(.+?)\)\s*\{([\s\S]*)\}/);
    if (!match) return;

    this.executeArduinoLine(match[1].trim() + ';');
    let iterations = 0;
    while (this.isRunning() && this.evalCondition(match[2].trim()) && iterations < 10000) {
      await this.executeArduinoBlockAsync(match[4]);
      this.executeArduinoLine(match[3].trim() + ';');
      iterations++;
    }
  }

  private evalCondition(expr: string): boolean {
    expr = expr.trim();
    const replaced = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
      if (this.variables.hasOwnProperty(match)) return String(this.variables[match]);
      if (match === 'HIGH') return '1';
      if (match === 'LOW') return '0';
      if (match === 'true') return 'true';
      if (match === 'false') return 'false';
      return match;
    });
    try {
      return Boolean(Function(`"use strict"; return (${replaced})`)());
    } catch {
      return false;
    }
  }

  private findMatchingBrace(code: string, start: number): number {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return code.length - 1;
  }

  private async executeArduinoLineAsync(line: string): Promise<void> {
    // delay() — esperar de verdad y actualizar UI
    if (/^delay\s*\(/.test(line)) {
      const match = line.match(/delay\s*\((.+?)\)/);
      if (match) {
        const ms = Number(this.evalArduinoExpr(match[1]));
        this.addLog('info', `⏱ delay(${ms}ms)`);
        // Forzar render antes de esperar
        this.cdr.detectChanges();
        await this.sleep(ms);
      }
      return;
    }

    //Todo lo demás es síncrono
    this.executeArduinoLine(line);
    // Forzar detección de cambios después de cada línea
    this.cdr.detectChanges();
  }

  private extractGlobalVariables(code: string): void {
    let globalCode = code;
    const fnRegex = /\w+\s+\w+\s*\([^)]*\)\s*\{/g;
    let match;
    const toRemove: { start: number; end: number }[] = [];

    while ((match = fnRegex.exec(code)) !== null) {
      let depth = 1;
      let i = match.index + match[0].length;
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        if (code[i] === '}') depth--;
        i++;
      }
      toRemove.push({ start: match.index, end: i });
    }

    toRemove.reverse().forEach(r => {
      globalCode = globalCode.slice(0, r.start) + globalCode.slice(r.end);
    });

    const lines = globalCode.split('\n').map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('#'));

    for (const line of lines) {
      const declMatch = line.match(/^(?:const\s+)?(?:int|float|double|char|bool|long|String|byte|unsigned\s+\w+)\s+(\w+)\s*=\s*(.+?)\s*;?$/);
      if (declMatch) {
        const val = this.evalArduinoExpr(declMatch[2]);
        this.variables[declMatch[1]] = val;
        this.addLog('info', `📦 Variable global: ${declMatch[1]} = ${val}`);
        continue;
      }
      const declNoValMatch = line.match(/^(?:const\s+)?(?:int|float|double|char|bool|long|String|byte)\s+(\w+)\s*;?$/);
      if (declNoValMatch) {
        this.variables[declNoValMatch[1]] = 0;
      }
    }
  }

  private extractFunctionBody(code: string, fnName: string): string {
    const regex = new RegExp(`void\\s+${fnName}\\s*\\(\\s*\\)\\s*\\{`);
    const match = regex.exec(code);
    if (!match) return '';

    let depth = 1;
    let i = match.index + match[0].length;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      i++;
    }
    return code.slice(match.index + match[0].length, i - 1);
  }

  private executeArduinoBlock(code: string): void {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    for (const line of lines) {
      this.executeArduinoLine(line);
    }
  }

  private executeArduinoLine(line: string): void {

    // Ignorar includes, defines y declaraciones de objetos de librerías
    if (line.startsWith('#') ||
      line.startsWith('Adafruit_') ||
      line.startsWith('Servo ') ||
      line.includes('display.begin') ||
      line.includes('display.clearDisplay') ||
      line.includes('display.setCursor') ||
      line.includes('display.setTextSize') ||
      line.includes('display.setTextColor') ||
      line.includes('Wire.begin')) {
      return;
    }

    // display.println / display.print — actualizar OLED/LCD
    if (/display\.(print|println)\s*\(/.test(line)) {
      const match = line.match(/display\.print(?:ln)?\s*\(\s*(.+?)\s*\)\s*;?$/);
      if (match) {
        const val = String(this.evalArduinoExpr(match[1]));
        this.updateComponentByType('oled', { text: val });
        this.updateComponentByType('lcd', {
          lines: [val, '']
        });
      }
      return;
    }

    // display.display() — mostrar buffer (ya lo hacemos en tiempo real)
    if (/display\.display\s*\(/.test(line)) return;

    // Servo.attach
    if (/\.\s*attach\s*\(/.test(line)) {
      const match = line.match(/(\w+)\s*\.\s*attach\s*\((.+?)\)/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[2]));
        this.addLog('info', `⚙️ Servo conectado al pin ${pin}`);
        // Registrar qué variable es el servo y en qué pin
        this.variables[`__servo_${match[1]}`] = pin;
      }
      return;
    }

    // Servo.write — miServo.write(90)
    if (/\.\s*write\s*\(/.test(line)) {
      const match = line.match(/(\w+)\s*\.\s*write\s*\((.+?)\)/);
      if (match) {
        const angle = Number(this.evalArduinoExpr(match[2]));
        const servoPin = this.variables[`__servo_${match[1]}`];
        this.updateComponentByType('servo', { angle });
        if (servoPin !== undefined) {
          this.updateComponentsFromPin(servoPin, angle);
        }
        this.addLog('output', `⚙️ Servo → ${angle}°`);
      }
      return;
    }

    // digitalRead — retorna el estado real del pin
    if (/digitalRead\s*\(/.test(line)) {
      // Se maneja en assignments abajo
    }

    // Variable declaration con posible digitalRead / analogRead
    const declMatch = line.match(/^(?:const\s+)?(?:int|float|double|char|bool|long|String|byte)\s+(\w+)\s*=\s*(.+?)\s*;?$/);
    if (declMatch) {
      const varName = declMatch[1];
      const expr = declMatch[2].trim();

      if (/digitalRead\s*\(/.test(expr)) {
        const pinMatch = expr.match(/digitalRead\s*\((.+?)\)/);
        if (pinMatch) {
          const pin = Number(this.evalArduinoExpr(pinMatch[1]));
          // Leer estado real del pin desde pinStates
          // INPUT_PULLUP: sin presionar = HIGH (1), presionado = LOW (0)
          const isPullup = this.pinModes[pin] === 'input';
          const buttonComp = this.components().find(c =>
            c.type === 'button' && c.pins.some(p => Number(p.connectedTo) === pin)
          );
          const pressed = buttonComp?.state['pressed'] ?? false;
          // Con INPUT_PULLUP: pressed=true → LOW(0), pressed=false → HIGH(1)
          this.variables[varName] = pressed ? 0 : 1;
          this.addLog('info', `📖 digitalRead(${pin}) = ${this.variables[varName]}`);
        }
      } else if (/analogRead\s*\(/.test(expr)) {
        const pinMatch = expr.match(/analogRead\s*\((.+?)\)/);
        if (pinMatch) {
          const pin = Number(this.evalArduinoExpr(pinMatch[1]));
          const potComp = this.components().find(c =>
            c.type === 'potentiometer' && c.pins.some(p => Number(p.connectedTo) === pin)
          );
          this.variables[varName] = potComp?.state['value'] ?? 0;
          this.addLog('info', `📖 analogRead(${pin}) = ${this.variables[varName]}`);
        }
      } else {
        this.variables[varName] = this.evalArduinoExpr(expr);
      }
      return;
    }

    // Assignment con digitalRead / analogRead
    const assignMatch = line.match(/^(\w+)\s*=\s*(.+?)\s*;?$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const expr = assignMatch[2].trim();

      if (/digitalRead\s*\(/.test(expr)) {
        const pinMatch = expr.match(/digitalRead\s*\((.+?)\)/);
        if (pinMatch) {
          const pin = Number(this.evalArduinoExpr(pinMatch[1]));
          const buttonComp = this.components().find(c =>
            c.type === 'button' && c.pins.some(p => Number(p.connectedTo) === pin)
          );
          const pressed = buttonComp?.state['pressed'] ?? false;
          this.variables[varName] = pressed ? 0 : 1;
          this.addLog('info', `📖 digitalRead(${pin}) = ${this.variables[varName]}`);
        }
        return;
      }

      if (/analogRead\s*\(/.test(expr)) {
        const pinMatch = expr.match(/analogRead\s*\((.+?)\)/);
        if (pinMatch) {
          const pin = Number(this.evalArduinoExpr(pinMatch[1]));
          const potComp = this.components().find(c =>
            c.type === 'potentiometer' && c.pins.some(p => Number(p.connectedTo) === pin)
          );
          this.variables[varName] = potComp?.state['value'] ?? 0;
          this.addLog('info', `📖 analogRead(${pin}) = ${this.variables[varName]}`);
        }
        return;
      }

      if (this.variables.hasOwnProperty(varName)) {
        this.variables[varName] = this.evalArduinoExpr(expr);
        return;
      }
    }

    // Increment/decrement
    const incMatch = line.match(/^(\w+)(\+\+|--)\s*;?$/);
    if (incMatch && this.variables.hasOwnProperty(incMatch[1])) {
      this.variables[incMatch[1]] += incMatch[2] === '++' ? 1 : -1;
      return;
    }

    // Serial.begin
    if (/Serial\.begin\s*\(/.test(line)) {
      const baud = line.match(/Serial\.begin\s*\((\d+)\)/)?.[1] || '9600';
      this.addLog('info', `📡 Serial iniciado a ${baud} baud`);
      return;
    }

    // Serial.println / Serial.print
    if (/Serial\.print/.test(line)) {
      const match = line.match(/Serial\.print(?:ln)?\s*\(\s*(.+?)\s*\)\s*;?\s*$/);
      if (match) {
        const val = this.evalArduinoExpr(match[1].trim());
        this.addLog('output', String(val));
      }
      return;
    }

    // pinMode
    if (/pinMode\s*\(/.test(line)) {
      const match = line.match(/pinMode\s*\((.+?)\s*,\s*(INPUT|OUTPUT|INPUT_PULLUP)\)/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[1]));
        const mode = match[2] === 'OUTPUT' ? 'output' : 'input';
        this.pinModes[pin] = mode;
        this.addLog('info', `📌 Pin ${pin} → ${match[2]}`);
      }
      return;
    }

    // digitalWrite
    if (/digitalWrite\s*\(/.test(line)) {
      const match = line.match(/digitalWrite\s*\((.+?)\s*,\s*(.+?)\)\s*;?$/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[1]));
        const rawVal = match[2].trim();
        const state = rawVal === 'HIGH' ? 1 : rawVal === 'LOW' ? 0 : Number(this.evalArduinoExpr(rawVal));
        this.pinStates[pin] = state;
        this.updateComponentsFromPin(pin, state);
        this.addLog('output', `⚡ Pin ${pin} → ${state ? 'HIGH' : 'LOW'}`);
      }
      return;
    }

    // analogWrite
    if (/analogWrite\s*\(/.test(line)) {
      const match = line.match(/analogWrite\s*\((.+?)\s*,\s*(.+?)\)\s*;?$/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[1]));
        const val = Number(this.evalArduinoExpr(match[2]));
        this.pinStates[pin] = val;
        this.updateComponentsFromPin(pin, val);
        this.addLog('output', `〰️ Pin ${pin} PWM → ${val}`);
      }
      return;
    }

    // tone
    if (/tone\s*\(/.test(line)) {
      const match = line.match(/tone\s*\((.+?)\s*,\s*(.+?)\)/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[1]));
        const freq = Number(this.evalArduinoExpr(match[2]));
        this.updateComponentsFromPin(pin, freq, 'buzzer');
        this.addLog('output', `🔊 Buzzer pin ${pin} → ${freq}Hz`);
      }
      return;
    }

    // noTone
    if (/noTone\s*\(/.test(line)) {
      const match = line.match(/noTone\s*\((.+?)\)/);
      if (match) {
        const pin = Number(this.evalArduinoExpr(match[1]));
        this.updateComponentsFromPin(pin, 0, 'buzzer');
        this.addLog('output', `🔇 Buzzer pin ${pin} → OFF`);
      }
      return;
    }

    // if statement — evaluar condición
    if (/^if\s*\(/.test(line)) {
      const match = line.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
      if (match) {
        // La condición se evaluará en executeArduinoBlockAsync
      }
      return;
    }
  }

  private evalArduinoExpr(expr: string): any {
    expr = expr.trim().replace(/;$/, '');
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (expr === 'HIGH') return 1;
    if (expr === 'LOW') return 0;
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'INPUT') return 0;
    if (expr === 'OUTPUT') return 1;
    if (!isNaN(Number(expr))) return Number(expr);
    if (this.variables.hasOwnProperty(expr)) return this.variables[expr];

    const replaced = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
      if (this.variables.hasOwnProperty(match)) return String(this.variables[match]);
      if (match === 'HIGH') return '1';
      if (match === 'LOW') return '0';
      return match;
    });

    try {
      return Function(`"use strict"; return (${replaced})`)();
    } catch {
      return expr;
    }
  }

  //Component state updates
  private updateComponentsFromPin(pinNum: number, value: number, forceType?: string): void {
    const current = this.components();
    const updated = current.map(comp => {
      const connectedPin = comp.pins.find(p => Number(p.connectedTo) === Number(pinNum));
      if (!connectedPin) return comp;
      if (forceType && comp.type !== forceType) return comp;
      const newState = this.computeComponentState(comp, connectedPin.name, value);
      return { ...comp, state: { ...comp.state, ...newState } };
    });


    this.components.set([...updated]);
    const states: Record<string, Record<string, any>> = {};
    updated.forEach(c => { states[c.id] = { ...c.state }; });
    this.componentStates.set({ ...states });
  }

  private updateComponentByType(type: string, stateUpdate: Record<string, any>): void {
    const updated = this.components().map(c =>
      c.type === type ? { ...c, state: { ...c.state, ...stateUpdate } } : c
    );
    this.components.set([...updated]);
    const states: Record<string, Record<string, any>> = {};
    updated.forEach(c => { states[c.id] = { ...c.state }; });
    this.componentStates.set({ ...states });
  }

  private computeComponentState(
    comp: EmulatorComponent,
    pinName: string,
    value: number
  ): Record<string, any> {
    switch (comp.type) {
      case 'led':
        if (pinName === 'A') return { on: value > 0, brightness: value };
        return {};
      case 'buzzer':
        return { on: value > 0, frequency: value };
      case 'servo':
        return { angle: Math.min(180, Math.max(0, value)) };
      case 'motor_dc':
        if (pinName === 'ENA') return { speed: value };
        if (pinName === 'IN1') return { in1: value };
        if (pinName === 'IN2') return { in2: value };
        return {};
      case 'segment7':
        return { digit: value };
      default:
        return {};
    }
  }

  getCompState(compId: string): Record<string, any> {
    return this.componentStates()[compId] || {};
  }

  // Serial
  sendSerialInput(): void {
    const val = this.serialInput();
    if (!val.trim()) return;
    this.addLog('input', `> ${val}`);
    this.serialInput.set('');
  }

  private addLog(type: SerialEntry['type'], text: string): void {
    this.serialOutput.update(s => [...s, { type, text }]);
  }

  //Component interactions
  toggleButton(comp: EmulatorComponent): void {
    const pressed = !comp.state['pressed'];
    this.components.update(cs =>
      cs.map(c => c.id === comp.id ? { ...c, state: { ...c.state, pressed } } : c)
    );
    const sigPin = comp.pins.find(p => p.name === 'SIG');
    if (sigPin?.connectedTo !== null && sigPin?.connectedTo !== undefined) {
      this.pinStates[sigPin.connectedTo] = pressed ? 1 : 0;
      this.addLog('info', `🔘 Botón ${pressed ? 'presionado' : 'soltado'} → pin ${sigPin.connectedTo}`);
    }
  }

  setPotentiometer(comp: EmulatorComponent, value: number): void {
    this.components.update(cs =>
      cs.map(c => c.id === comp.id
        ? { ...c, state: { ...c.state, value, angle: (value / 1023) * 270 } } : c)
    );
    const sigPin = comp.pins.find(p => p.name === 'SIG');
    if (sigPin?.connectedTo !== null && sigPin?.connectedTo !== undefined) {
      this.pinStates[sigPin.connectedTo] = value;
    }
  }

  setLedColor(comp: EmulatorComponent, color: string): void {
    this.components.update(cs =>
      cs.map(c => c.id === comp.id ? { ...c, color } : c)
    );
  }

  setDistance(comp: EmulatorComponent, value: number): void {
    this.components.update(cs =>
      cs.map(c => c.id === comp.id ? { ...c, state: { ...c.state, distance: value } } : c)
    );
  }

  setTemperature(comp: EmulatorComponent, value: number): void {
    this.components.update(cs =>
      cs.map(c => c.id === comp.id ? { ...c, state: { ...c.state, temperature: value } } : c)
    );
  }

  //
  // Helpers
  getDefaultColor(type: ComponentType): string {
    const colors: Partial<Record<ComponentType, string>> = {
      led: '#ff0000', button: '#4a90d9', buzzer: '#888',
      servo: '#555', motor_dc: '#333',
    };
    return colors[type] || '#666';
  }

  getPinLabel(pin: BoardPin): string {
    if (pin.type === 'power') return '5V';
    if (pin.type === 'gnd') return 'GND';
    if (pin.type === 'analog') return `A${pin.number - 14}`;
    return `D${pin.number}`;
  }

  getPinState(pinNum: number): number {
    return this.pinStates[pinNum] ?? 0;
  }

  getServoRotation(comp: EmulatorComponent): string {
    return `rotate(${comp.state['angle'] || 90}deg)`;
  }

  getSegmentActive(comp: EmulatorComponent, segment: string): boolean {
    const digit = comp.state['digit'] ?? 0;
    const segments: Record<number, string[]> = {
      0: ['a','b','c','d','e','f'], 1: ['b','c'],
      2: ['a','b','d','e','g'], 3: ['a','b','c','d','g'],
      4: ['b','c','f','g'], 5: ['a','c','d','f','g'],
      6: ['a','c','d','e','f','g'], 7: ['a','b','c'],
      8: ['a','b','c','d','e','f','g'], 9: ['a','b','c','d','f','g'],
    };
    return (segments[digit] || []).includes(segment);
  }

  trackById(_: number, item: any): string {
    return item.id;
  }

  close(): void {
    this.stopSimulation();
    this.closed.emit();
  }
}
