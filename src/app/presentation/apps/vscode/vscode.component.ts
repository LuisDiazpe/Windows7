import {
  Component, signal, computed, inject,
  ViewChild, ElementRef, AfterViewInit, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { FileSystemService } from '../../../infrastructure/adapters/file-system.service';
import { NotificationService } from '../../../infrastructure/state/notification.service';
import { PsintInterpreter } from './interpreters/psint.interpreter';
import { JavaScriptInterpreter } from './interpreters/javascript.interpreter';
import { CppInterpreter } from './interpreters/cpp.interpreter';
import { ArduinoInterpreter } from './interpreters/arduino.interpreter';
import { ArduinoEmulatorComponent } from './arduino-emulator/arduino-emulator.component';

type Language = 'psint' | 'javascript' | 'python' | 'html' | 'cpp' | 'arduino';
type Theme = 'dark' | 'light';
type Panel = 'explorer' | 'search' | null;


interface EditorTab {
  id: string;
  name: string;
  language: Language;
  content: string;
  modified: boolean;
  path: string;
}

interface ConsoleEntry {
  text: string;
  type: 'output' | 'error' | 'info' | 'success' | 'input';
}

@Component({
  selector: 'app-vscode',
  standalone: true,
  imports: [CommonModule, FormsModule, ArduinoEmulatorComponent],
  templateUrl: './vscode.component.html',
  styleUrl: './vscode.component.css',
})
export class VscodeComponent implements AfterViewInit {

  // Consola interactiva
  waitingForInput = signal(false);
  inputPrompt = signal('');
  consoleInput = signal('');
  private inputResolver: ((value: string) => void) | null = null;

  @ViewChild('consoleInputEl') consoleInputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('consoleBody') consoleBodyEl!: ElementRef<HTMLDivElement>;
  @ViewChild('editorArea') editorArea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('lineNumbers') lineNumbers!: ElementRef<HTMLDivElement>;
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;


  private requestInput(prompt: string): Promise<string> {
    return new Promise(resolve => {
      if (prompt.trim()) {
        prompt.split('\n').forEach(line => {
          if (line.trim()) this.addConsole('output', line);
        });
      }

      this.inputPrompt.set('');
      this.waitingForInput.set(true);
      this.inputResolver = (value: string) => {
        // Si hay un resolver de Python esperando, llamarlo también
        if ((window as any).__pythonResolveInput__) {
          (window as any).__pythonResolveInput__(value);
          (window as any).__pythonResolveInput__ = null;
        }
        resolve(value);
      };
      setTimeout(() => this.consoleInputEl?.nativeElement?.focus(), 50);
    });
  }

  private injectAwaitToPrompt(code: string): string {
    const result: string[] = [];
    let i = 0;

    while (i < code.length) {
      // Saltar strings con comillas simples
      if (code[i] === "'") {
        let j = i + 1;
        while (j < code.length && !(code[j] === "'" && code[j - 1] !== '\\')) j++;
        result.push(code.slice(i, j + 1));
        i = j + 1;
        continue;
      }

      // Saltar strings con comillas dobles
      if (code[i] === '"') {
        let j = i + 1;
        while (j < code.length && !(code[j] === '"' && code[j - 1] !== '\\')) j++;
        result.push(code.slice(i, j + 1));
        i = j + 1;
        continue;
      }

      // Saltar template literals
      if (code[i] === '`') {
        let j = i + 1;
        while (j < code.length && !(code[j] === '`' && code[j - 1] !== '\\')) j++;
        result.push(code.slice(i, j + 1));
        i = j + 1;
        continue;
      }

      // Saltar comentarios de línea //
      if (code[i] === '/' && code[i + 1] === '/') {
        let j = i;
        while (j < code.length && code[j] !== '\n') j++;
        result.push(code.slice(i, j));
        i = j;
        continue;
      }

      // Saltar comentarios de bloque /* */
      if (code[i] === '/' && code[i + 1] === '*') {
        let j = i + 2;
        while (j < code.length && !(code[j] === '*' && code[j + 1] === '/')) j++;
        result.push(code.slice(i, j + 2));
        i = j + 2;
        continue;
      }

      // Detectar prompt( fuera de strings
      if (code.slice(i, i + 7) === 'prompt(') {
        const before = result.join('').trimEnd();
        if (!before.endsWith('await')) {
          result.push('await prompt(');
        } else {
          result.push('prompt(');
        }
        i += 7;
        continue;
      }

      result.push(code[i]);
      i++;
    }

    return result.join('');
  }
  private transformCode(code: string): string {
    let result = code
      .replace(/\bfunction\s+(\w+)\s*\(/g, 'async function $1(')
      .replace(/\bfunction\s*\(/g, 'async function (')
      .replace(/\b(const|let|var)\s+(\w+)\s*=\s*function\s*\(/g, '$1 $2 = async function (')
      .replace(/(\([\w\s,]*\))\s*=>\s*\{/g, 'async $1 => {');
    result = this.injectAwaitToPrompt(result);
    const fnNames: string[] = [];
    const fnRegex = /async function\s+(\w+)\s*\(/g;
    let match;
    while ((match = fnRegex.exec(result)) !== null) {
      fnNames.push(match[1]);
    }

    fnNames.forEach(name => {
      const callRegex = new RegExp(`(?<!await\\s)\\b${name}\\s*\\(`, 'g');
      result = result.replace(callRegex, `await ${name}(`);
    });

    return result;
  }
  submitConsoleInput(): void {
    const value = this.consoleInput();
    if (!this.inputResolver) return;
    this.addConsole('info', `> ${value}`);
    this.inputResolver(value);
    this.inputResolver = null;
    this.consoleInput.set('');
    this.waitingForInput.set(false);
  }

  onConsoleInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.submitConsoleInput();
  }
  private readonly fs = inject(FileSystemService);
  private readonly ns = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly searchLines = computed(() => {
    const content = this.activeTab()?.content || '';
    const query = this.searchQuery();
    if (!query) return [];
    return content.split('\n')
      .map((text, index) => ({ text, line: index + 1 }))
      .filter(item => item.text.toLowerCase().includes(query.toLowerCase()));
  });

  theme = signal<Theme>('dark');
  activePanel = signal<Panel>('explorer');
  tabs = signal<EditorTab[]>([]);
  activeTabId = signal<string>('');
  consoleOutput = signal<ConsoleEntry[]>([]);
  showConsole = signal(true);
  showPreview = signal(false);
  isRunning = signal(false);
  previewUrl = signal<SafeResourceUrl | null>(null);
  explorerPath = signal('C:\\Users\\User\\Documents');
  searchQuery = signal('');
  fontSize = signal(14);
  showAutocomplete = signal(false);
  autocompleteItems = signal<string[]>([]);
  cursorLine = signal(1);
  cursorCol = signal(1);
  pythonReady = signal(false);
  showArduinoEmulator = signal(false);

  private pythonWorker: Worker | null = null;
  private pythonWorkerReady = false;
  private pythonSabControl: Int32Array | null = null;
  private pythonSabData: Uint8Array | null = null;

  readonly activeTab = computed(() =>
    this.tabs().find(t => t.id === this.activeTabId())
  );

  readonly explorerEntries = computed(() =>
    this.fs.getEntries(this.explorerPath())
  );

  readonly lineCount = computed(() => {
    const content = this.activeTab()?.content || '';
    return content.split('\n').length;
  });

  readonly lineNumbersArr = computed(() =>
    Array.from({ length: Math.max(this.lineCount(), 1) }, (_, i) => i + 1)
  );
  readonly activeLangLabel = computed(() =>
    this.languages.find(l => l.id === this.activeTab()?.language)?.label || 'Plain Text'
  );

  readonly languages: { id: Language; label: string; ext: string; color: string }[] = [
    { id: 'psint', label: 'PSeInt', ext: '.psc', color: '#569cd6' },
    { id: 'javascript', label: 'JavaScript', ext: '.js', color: '#f0db4f' },
    { id: 'python', label: 'Python', ext: '.py', color: '#3572A5' },
    { id: 'html', label: 'HTML/CSS', ext: '.html', color: '#e34c26' },
    { id: 'cpp', label: 'C++', ext: '.cpp', color: '#f34b7d' },
    { id: 'arduino', label: 'Arduino', ext: '.ino', color: '#00979D' },
  ];

  readonly templates: Record<Language, string> = {
    psint: `Algoritmo HolaMundo
  Definir nombre Como Cadena
  Escribir "¿Cuál es tu nombre?"
  Leer nombre
  Escribir "¡Hola, ", nombre, "!"
  Para i <- 1 Hasta 5 Hacer
    Escribir "Número: ", i
  FinPara
FinAlgoritmo`,

    javascript: `// JavaScript en Windows 7
const nombre = "Windows 7";
console.log("Hola desde " + nombre);

// Funciones
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i <= 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}

// Arrays y objetos
const datos = [1, 2, 3, 4, 5];
const suma = datos.reduce((a, b) => a + b, 0);
console.log("Suma:", suma);`,

    python: `# Python en Windows 7
nombre = "Windows 7"
print(f"Hola desde {nombre}")

# Lista y comprensión
numeros = [i**2 for i in range(1, 11)]
print("Cuadrados:", numeros)

# Función
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")`,

    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mi Página</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a6db5, #0d3d6e);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0 0 16px; font-size: 32px; }
    button {
      padding: 10px 24px;
      background: #4a90d9;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover { background: #5aa0e9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>¡Hola Windows 7!</h1>
    <p>Página creada con el editor integrado</p>
    <button onclick="alert('¡Funciona!')">Click me</button>
  </div>
</body>
</html>`,

    cpp: `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << "=== C++ Emulator ===" << endl;

    // Variables
    int x = 10;
    float pi = 3.14159;
    string nombre = "Windows 7";

    cout << "Nombre: " << nombre << endl;
    cout << "x = " << x << endl;
    cout << "pi = " << pi << endl;

    // Loop
    for (int i = 1; i <= 5; i++) {
        cout << i << "! = " << factorial(i) << endl;
    }

    return 0;
}`,

    arduino: `// Arduino LED Blink
const int LED_PIN = 13;
const int BUTTON_PIN = 2;
int contador = 0;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
  Serial.println("Arduino iniciado!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);

  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);

  contador++;
  Serial.println(contador);
}`,
  };

  ngAfterViewInit(): void {
    this.newTab('psint');
  }

  newTab(language: Language = 'javascript'): void {
    const lang = this.languages.find(l => l.id === language)!;
    const tab: EditorTab = {
      id: crypto.randomUUID(),
      name: `untitled${this.tabs().length + 1}${lang.ext}`,
      language,
      content: this.templates[language],
      modified: false,
      path: '',
    };
    this.tabs.update(t => [...t, tab]);
    this.activeTabId.set(tab.id);
    this.consoleOutput.set([]);
    this.showPreview.set(false);
  }

  closeTab(id: string, e: MouseEvent): void {
    e.stopPropagation();
    const tab = this.tabs().find(t => t.id === id);
    if (tab?.modified) {
      if (!confirm(`Save changes to ${tab.name}?`)) return;
    }
    const remaining = this.tabs().filter(t => t.id !== id);
    this.tabs.set(remaining);
    if (this.activeTabId() === id) {
      this.activeTabId.set(remaining[remaining.length - 1]?.id || '');
      if (remaining.length === 0) this.newTab('javascript');
    }
  }

  switchTab(id: string): void {
    this.activeTabId.set(id);
    this.showPreview.set(false);
    this.consoleOutput.set([]);
  }

  onContentChange(content: string): void {
    this.tabs.update(tabs =>
      tabs.map(t => t.id === this.activeTabId() ? { ...t, content, modified: true } : t)
    );
    this.updateCursor();
    if (this.activeTab()?.language === 'html') {
      this.updateHtmlPreview();
    }
  }

  onCursorMove(e: Event): void {
    this.updateCursor();
    this.syncScroll();
  }

  private updateCursor(): void {
    const ta = this.editorArea?.nativeElement;
    if (!ta) return;
    const text = ta.value.substring(0, ta.selectionStart);
    const lines = text.split('\n');
    this.cursorLine.set(lines.length);
    this.cursorCol.set(lines[lines.length - 1].length + 1);
  }

  syncScroll(): void {
    const ta = this.editorArea?.nativeElement;
    const ln = this.lineNumbers?.nativeElement;
    if (ta && ln) ln.scrollTop = ta.scrollTop;
  }

  async run(): Promise<void> {
    const tab = this.activeTab();
    if (!tab) return;

    this.isRunning.set(true);
    this.consoleOutput.set([]);
    this.showConsole.set(true);
    this.showPreview.set(false);

    this.addConsole('info', `▶ Running ${tab.name}...`);
    this.addConsole('info', '─'.repeat(40));

    try {
      switch (tab.language) {
        case 'psint': await this.runPsint(tab.content); break;
        case 'javascript': await this.runJavaScript(tab.content); break;
        case 'python': await this.runPython(tab.content); break;
        case 'html': this.runHtml(tab.content); break;
        case 'cpp': await this.runCpp(tab.content); break;
        case 'arduino': await this.runArduino(tab.content); break;
      }
    } finally {
      this.isRunning.set(false);
      this.addConsole('info', '─'.repeat(40));
      this.addConsole('info', ` Finished`);
    }
  }

  private async runPsint(code: string): Promise<void> {
    const interpreter = new PsintInterpreter();
    interpreter.setInputHandler((prompt: string) => this.requestInput(prompt));
    interpreter.setOutputHandler((line: string) => this.addConsole('output', line));
    const result = await interpreter.executeAsync(code);
    if (result.error) this.addConsole('error', `Error: ${result.error}`);
  }

  private async runJavaScript(code: string): Promise<void> {
    const interpreter = new JavaScriptInterpreter();
    interpreter.setInputHandler((prompt: string) => this.requestInput(prompt));
    interpreter.setOutputHandler((line: string) => this.addConsole('output', line));
    const result = await interpreter.executeAsync(code);
    if (result.error) this.addConsole('error', `Error: ${result.error}`);
  }

  private async runPython(code: string): Promise<void> {
    if (!this.pythonWorker) {
      this.addConsole('info', 'Cargando Python (Pyodide)...');

      this.pythonWorker = new Worker('/assets/python.worker.js');

      await new Promise<void>((resolve, reject) => {
        this.pythonWorker!.onmessage = (e) => {
          if (e.data.type === 'ready') {
            const sab = e.data.sab;
            this.pythonSabControl = new Int32Array(sab, 0, 1);
            this.pythonSabData = new Uint8Array(sab, 4);
            this.pythonWorkerReady = true;
            this.pythonReady.set(true);
            this.addConsole('success', 'Python listo!');
            resolve();
          }
        };
        this.pythonWorker!.onerror = (e) => {
          this.addConsole('error', 'Error iniciando worker: ' + e.message);
          reject(e);
        };
        this.pythonWorker!.postMessage({ type: 'init' });
      });
    }

    return new Promise<void>((resolve) => {
      this.pythonWorker!.onmessage = async (e) => {
        if (e.data.type === 'input_request') {
          const value = await this.requestInput(e.data.prompt);
          const encoded = new TextEncoder().encode(value);
          this.pythonSabData!.fill(0);
          this.pythonSabData!.set(encoded);
          Atomics.store(this.pythonSabControl!, 0, 1);
          Atomics.notify(this.pythonSabControl!, 0);

        } else if (e.data.type === 'output') {
          // muestra cada print() en tiempo real
          this.addConsole('output', e.data.text);

        } else if (e.data.type === 'done') {
          resolve();

        } else if (e.data.type === 'error') {
          this.addConsole('error', e.data.error);
          resolve();
        }
      };

      this.pythonWorker!.postMessage({ type: 'run', code });
    });
  }

  private runHtml(code: string): void {
    this.showPreview.set(true);
    this.showConsole.set(false);
    this.updateHtmlPreview(code);
    this.addConsole('success', 'HTML preview updated');
  }

  private updateHtmlPreview(code?: string): void {
    const content = code || this.activeTab()?.content || '';
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  private async runCpp(code: string): Promise<void> {
    const interpreter = new CppInterpreter();
    interpreter.setOutputHandler((line: string) => this.addConsole('output', line));
    interpreter.setInputHandler((prompt: string) => this.requestInput(prompt));
    const result = await interpreter.executeAsync(code);
    if (result.error) this.addConsole('error', `Error: ${result.error}`);
  }

  private async runArduino(code: string): Promise<void> {
    const interpreter = new ArduinoInterpreter();
    const result = interpreter.execute(code);
    result.output.forEach(line => this.addConsole('output', line));
    if (result.error) this.addConsole('error', `Error: ${result.error}`);
    if (result.pins && Object.keys(result.pins).length > 0) {
      this.addConsole('info', '--- Pin States ---');
      Object.entries(result.pins).forEach(([pin, state]) => {
        this.addConsole(state ? 'success' : 'output', `Pin ${pin}: ${state ? '■ HIGH' : '□ LOW'}`);
      });
    }
  }

  private addConsole(type: ConsoleEntry['type'], text: string): void {
    this.consoleOutput.update(c => [...c, { text, type }]);
  }

  saveFile(): void {
    const tab = this.activeTab();
    if (!tab) return;
    const path = 'C:\\Users\\User\\Documents';
    this.fs.writeFile(path, tab.name, tab.content);
    this.tabs.update(tabs =>
      tabs.map(t => t.id === tab.id ? { ...t, modified: false, path } : t)
    );
    this.ns.success('File saved', `${tab.name} saved to Documents`);
  }

  openFile(name: string, path: string): void {
    const content = this.fs.readFile(path, name);
    if (content === null) return;

    const ext = name.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, Language> = {
      'psc': 'psint', 'js': 'javascript', 'py': 'python',
      'html': 'html', 'htm': 'html', 'cpp': 'cpp',
      'c': 'cpp', 'h': 'cpp', 'ino': 'arduino',
    };
    const language = langMap[ext] || 'javascript';

    const existing = this.tabs().find(t => t.name === name && t.path === path);
    if (existing) { this.activeTabId.set(existing.id); return; }

    const tab: EditorTab = {
      id: crypto.randomUUID(),
      name, language, content,
      modified: false, path,
    };
    this.tabs.update(t => [...t, tab]);
    this.activeTabId.set(tab.id);
  }

  changeLanguage(lang: Language): void {
    const tab = this.activeTab();
    if (!tab) return;
    const langDef = this.languages.find(l => l.id === lang)!;
    const newName = tab.name.replace(/\.[^.]+$/, '') + langDef.ext;
    this.tabs.update(tabs =>
      tabs.map(t => t.id === tab.id ? { ...t, language: lang, name: newName } : t)
    );
  }

  toggleTheme(): void {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  togglePanel(panel: Panel): void {
    this.activePanel.update(p => p === panel ? null : panel);
  }

  navigateExplorer(path: string): void {
    this.explorerPath.set(path);
  }

  goUpExplorer(): void {
    const parts = this.explorerPath().split('\\');
    if (parts.length > 1) {
      parts.pop();
      this.explorerPath.set(parts.join('\\') || 'C:\\');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.saveFile(); }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.run(); }
    if (e.key === 'F5') { e.preventDefault(); this.run(); }
  }

  onTabKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const content = this.activeTab()?.content || '';
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      this.onContentChange(newContent);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  getHighlightedCode(): string {
    const tab = this.activeTab();
    if (!tab) return '';
    return this.highlight(tab.content, tab.language);
  }

  private highlight(code: string, lang: Language): string {
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const keywords: Record<Language, string[]> = {
      psint: ['Algoritmo', 'FinAlgoritmo', 'Proceso', 'FinProceso', 'Si', 'Entonces', 'SiNo', 'FinSi', 'Para', 'Hasta', 'Hacer', 'FinPara', 'Mientras', 'FinMientras', 'Repetir', 'HastaQue', 'Escribir', 'Leer', 'Definir', 'Como', 'Entero', 'Real', 'Cadena', 'Logico', 'Funcion', 'FinFuncion', 'Retornar', 'Imprimir', 'Mostrar'],
      javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'new', 'this', 'import', 'export', 'default', 'async', 'await', 'try', 'catch', 'finally', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false'],
      python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'import', 'from', 'class', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'pass', 'break', 'continue', 'True', 'False', 'None', 'print', 'range', 'len'],
      html: ['html', 'head', 'body', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'a', 'img', 'ul', 'li', 'input', 'button', 'style', 'script', 'link', 'meta', 'title', 'form', 'table', 'tr', 'td'],
      cpp: ['int', 'float', 'double', 'char', 'bool', 'string', 'void', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'struct', 'new', 'delete', 'namespace', 'using', 'include', 'cout', 'cin', 'endl', 'true', 'false', 'nullptr'],
      arduino: ['void', 'int', 'float', 'char', 'bool', 'byte', 'long', 'String', 'setup', 'loop', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'pinMode', 'delay', 'millis', 'Serial', 'INPUT', 'OUTPUT', 'HIGH', 'LOW', 'if', 'else', 'for', 'while', 'return', 'const'],
    };

    const kws = keywords[lang] || [];
    kws.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'g');
      escaped = escaped.replace(regex, `<span class="kw">${kw}</span>`);
    });

    // Strings
    escaped = escaped.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="str">"$1"</span>');
    escaped = escaped.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, "<span class='str'>'$1'</span>");

    // Numbers
    escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');

    // Comments
    escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span class="cmt">$1</span>');
    escaped = escaped.replace(/(#[^\n]*)/g, '<span class="cmt">$1</span>');

    return escaped;
  }

  clearConsole(): void {
    this.consoleOutput.set([]);
  }

  openInBrowser(): void {
    const tab = this.activeTab();
    if (!tab || tab.language !== 'html') return;
    const blob = new Blob([tab.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  getLangColor(lang: Language): string {
    return this.languages.find(l => l.id === lang)?.color || '#888';
  }
}
