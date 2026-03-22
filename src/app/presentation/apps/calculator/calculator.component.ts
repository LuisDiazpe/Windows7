import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

type CalcMode = 'standard' | 'scientific';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.component.html',
  styleUrl: './calculator.component.css',
})
export class CalculatorComponent {
  display = signal('0');
  expression = signal('');
  mode = signal<CalcMode>('standard');
  showMenu = signal<string | null>(null);

  private firstOperand: number | null = null;
  private operator: string | null = null;
  private shouldResetDisplay = false;
  private memory = 0;

  toggleMenu(menu: string): void {
    this.showMenu.set(this.showMenu() === menu ? null : menu);
  }

  setMode(m: CalcMode): void {
    this.mode.set(m);
    this.showMenu.set(null);
  }

  input(value: string): void {
    if (this.shouldResetDisplay) {
      this.display.set(value === '.' ? '0.' : value);
      this.shouldResetDisplay = false;
      return;
    }

    if (value === '.') {
      if (!this.display().includes('.')) {
        this.display.update(d => d + '.');
      }
      return;
    }

    if (this.display() === '0') {
      this.display.set(value);
    } else {
      if (this.display().length < 16) {
        this.display.update(d => d + value);
      }
    }
  }

  setOperator(op: string): void {
    const current = parseFloat(this.display());

    if (this.firstOperand !== null && !this.shouldResetDisplay) {
      this.calculate();
    } else {
      this.firstOperand = current;
    }

    this.operator = op;
    this.expression.set(`${this.display()} ${op}`);
    this.shouldResetDisplay = true;
  }

  calculate(): void {
    if (this.firstOperand === null || this.operator === null) return;

    const second = parseFloat(this.display());
    let result: number;

    switch (this.operator) {
      case '+': result = this.firstOperand + second; break;
      case '-': result = this.firstOperand - second; break;
      case '×': result = this.firstOperand * second; break;
      case '÷': result = second !== 0 ? this.firstOperand / second : 0; break;
      case '%': result = this.firstOperand % second; break;
      default: return;
    }

    this.expression.set(`${this.firstOperand} ${this.operator} ${second} =`);
    this.display.set(this.formatResult(result));
    this.firstOperand = result;
    this.operator = null;
    this.shouldResetDisplay = true;
  }

  scientific(fn: string): void {
    const val = parseFloat(this.display());
    let result: number;

    switch (fn) {
      case 'sin': result = Math.sin(val * Math.PI / 180); break;
      case 'cos': result = Math.cos(val * Math.PI / 180); break;
      case 'tan': result = Math.tan(val * Math.PI / 180); break;
      case 'log': result = Math.log10(val); break;
      case 'ln': result = Math.log(val); break;
      case 'sqrt': result = Math.sqrt(val); break;
      case 'sq': result = val * val; break;
      case 'inv': result = 1 / val; break;
      case 'pi': result = Math.PI; break;
      case 'e': result = Math.E; break;
      case 'pow': this.setOperator('^'); return;
      default: return;
    }

    this.expression.set(`${fn}(${val}) =`);
    this.display.set(this.formatResult(result));
    this.shouldResetDisplay = true;
  }

  toggleSign(): void {
    const val = parseFloat(this.display());
    this.display.set(this.formatResult(-val));
  }

  percent(): void {
    const val = parseFloat(this.display());
    this.display.set(this.formatResult(val / 100));
  }

  clear(): void {
    this.display.set('0');
    this.expression.set('');
    this.firstOperand = null;
    this.operator = null;
    this.shouldResetDisplay = false;
  }

  clearEntry(): void {
    this.display.set('0');
  }

  backspace(): void {
    if (this.display().length > 1) {
      this.display.update(d => d.slice(0, -1));
    } else {
      this.display.set('0');
    }
  }

  memoryStore(): void { this.memory = parseFloat(this.display()); }
  memoryRecall(): void { this.display.set(this.formatResult(this.memory)); this.shouldResetDisplay = true; }
  memoryClear(): void { this.memory = 0; }
  memoryAdd(): void { this.memory += parseFloat(this.display()); }
  memorySubtract(): void { this.memory -= parseFloat(this.display()); }

  private formatResult(n: number): string {
    if (isNaN(n)) return 'Error';
    if (!isFinite(n)) return 'Cannot divide by zero';
    const str = n.toPrecision(12);
    return parseFloat(str).toString();
  }
}
