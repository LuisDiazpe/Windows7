export interface ArduinoResult {
  output: string[];
  error?: string;
  pins?: Record<number, boolean>;
}

export class ArduinoInterpreter {
  private variables: Record<string, any> = {};
  private pins: Record<number, boolean> = {};
  private pinModes: Record<number, 'INPUT' | 'OUTPUT'> = {};
  private output: string[] = [];
  private loopCount = 0;
  private readonly MAX_LOOPS = 10;

  execute(code: string): ArduinoResult {
    this.variables = {};
    this.pins = {};
    this.pinModes = {};
    this.output = [];
    this.loopCount = 0;

    try {
      code = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

      const setupMatch = code.match(/void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\}/);
      const loopMatch = code.match(/void\s+loop\s*\(\s*\)\s*\{([\s\S]*?)\}/);

      if (!setupMatch && !loopMatch) {
        throw new Error('No setup() or loop() function found');
      }

      this.output.push('=== Arduino Emulator Started ===');
      this.output.push('');

      if (setupMatch) {
        this.output.push('--- setup() ---');
        this.executeBlock(setupMatch[1]);
        this.output.push('');
      }

      if (loopMatch) {
        this.output.push(`--- loop() × ${this.MAX_LOOPS} iterations ---`);
        for (let i = 0; i < this.MAX_LOOPS; i++) {
          this.loopCount = i;
          this.executeBlock(loopMatch[1]);
        }
      }

      this.output.push('');
      this.output.push('=== Pin States ===');
      Object.entries(this.pins).forEach(([pin, state]) => {
        this.output.push(`Pin ${pin}: ${state ? 'HIGH' : 'LOW'}`);
      });

      return { output: this.output, pins: this.pins };
    } catch (e: any) {
      return { output: this.output, error: e.message, pins: this.pins };
    }
  }

  private executeBlock(code: string): void {
    const statements = this.splitStatements(code);

    for (const stmt of statements) {
      const line = stmt.trim();
      if (!line) continue;

      // pinMode
      const pinModeMatch = line.match(/pinMode\s*\(\s*(\d+)\s*,\s*(INPUT|OUTPUT|INPUT_PULLUP)\s*\)/);
      if (pinModeMatch) {
        const pin = parseInt(pinModeMatch[1]);
        this.pinModes[pin] = pinModeMatch[2] as 'INPUT' | 'OUTPUT';
        this.output.push(`pinMode(${pin}, ${pinModeMatch[2]})`);
        continue;
      }

      // digitalWrite
      const digitalWriteMatch = line.match(/digitalWrite\s*\(\s*(.+?)\s*,\s*(HIGH|LOW|1|0|true|false|\w+)\s*\)/);
      if (digitalWriteMatch) {
        const pin = parseInt(this.evalExpr(digitalWriteMatch[1]));
        const val = digitalWriteMatch[2];
        const state = val === 'HIGH' || val === '1' || val === 'true' ||
          (this.variables[val] !== undefined && this.variables[val]);
        this.pins[pin] = state;
        this.output.push(`digitalWrite(${pin}, ${state ? 'HIGH' : 'LOW'})`);
        continue;
      }

      // digitalRead
      const digitalReadMatch = line.match(/(\w+)\s*=\s*digitalRead\s*\(\s*(\d+)\s*\)/);
      if (digitalReadMatch) {
        const pin = parseInt(digitalReadMatch[2]);
        this.variables[digitalReadMatch[1]] = this.pins[pin] ? 1 : 0;
        continue;
      }

      // analogWrite
      const analogWriteMatch = line.match(/analogWrite\s*\(\s*(\d+)\s*,\s*(.+?)\s*\)/);
      if (analogWriteMatch) {
        const pin = parseInt(analogWriteMatch[1]);
        const val = this.evalExpr(analogWriteMatch[2]);
        this.output.push(`analogWrite(${pin}, ${val})`);
        continue;
      }

      // analogRead
      const analogReadMatch = line.match(/(\w+)\s*=\s*analogRead\s*\(\s*(\d+)\s*\)/);
      if (analogReadMatch) {
        this.variables[analogReadMatch[1]] = Math.floor(Math.random() * 1024);
        continue;
      }

      // Serial.begin
      if (line.match(/Serial\.begin\s*\(\s*(\d+)\s*\)/)) {
        const baud = line.match(/Serial\.begin\s*\(\s*(\d+)\s*\)/)?.[1];
        this.output.push(`Serial initialized at ${baud} baud`);
        continue;
      }

      // Serial.println / Serial.print
      const serialPrintMatch = line.match(/Serial\.print(?:ln)?\s*\(\s*(.*?)\s*\)/);
      if (serialPrintMatch) {
        const val = this.evalExpr(serialPrintMatch[1]);
        const isLn = line.includes('println');
        this.output.push(`Serial: ${val}${isLn ? '' : ''}`);
        continue;
      }

      // delay
      const delayMatch = line.match(/delay\s*\(\s*(.+?)\s*\)/);
      if (delayMatch) {
        const ms = this.evalExpr(delayMatch[1]);
        this.output.push(`delay(${ms}ms)`);
        continue;
      }

      // Variable declaration
      const declMatch = line.match(/^(?:int|float|double|bool|byte|long|String|char)\s+(\w+)\s*(?:=\s*(.+))?$/);
      if (declMatch) {
        this.variables[declMatch[1]] = declMatch[2] ? this.evalExpr(declMatch[2]) : 0;
        continue;
      }

      // Assignment / increment
      if (line.match(/^\w+\s*(?:\+\+|--|[+\-*\/]?=)/)) {
        this.execAssignment(line);
        continue;
      }

      // if statement
      if (line.startsWith('if')) {
        const match = line.match(/if\s*\((.+)\)/);
        if (match) this.evalCondition(match[1]);
        continue;
      }

      // for loop
      if (line.startsWith('for')) {
        const match = line.match(/for\s*\((?:int\s+)?(\w+)\s*=\s*(.+?);\s*(.+?);\s*(\w+)\+\+\)/);
        if (match) {
          this.variables[match[1]] = this.evalExpr(match[2]);
          const to = this.evalExpr(match[3].replace(/\w+\s*<\s*/, ''));
          while (this.variables[match[1]] < to) {
            this.variables[match[1]]++;
          }
        }
        continue;
      }
    }
  }

  private execAssignment(line: string): void {
    if (line.match(/\w+\+\+/)) {
      const varName = line.match(/(\w+)\+\+/)?.[1];
      if (varName) this.variables[varName] = (this.variables[varName] || 0) + 1;
    } else if (line.match(/\w+--/)) {
      const varName = line.match(/(\w+)--/)?.[1];
      if (varName) this.variables[varName] = (this.variables[varName] || 0) - 1;
    } else {
      const m = line.match(/(\w+)\s*([+\-*\/]?=)\s*(.+)/);
      if (m) {
        const val = this.evalExpr(m[3]);
        if (m[2] === '=') this.variables[m[1]] = val;
        else if (m[2] === '+=') this.variables[m[1]] = (this.variables[m[1]] || 0) + val;
        else if (m[2] === '-=') this.variables[m[1]] = (this.variables[m[1]] || 0) - val;
        else if (m[2] === '*=') this.variables[m[1]] = (this.variables[m[1]] || 0) * val;
        else if (m[2] === '/=') this.variables[m[1]] = (this.variables[m[1]] || 0) / val;
      }
    }
  }

  private splitStatements(code: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (const ch of code) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (ch === ';' && depth === 0) {
        if (current.trim()) result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  }

  private evalExpr(expr: string): any {
    expr = expr.trim();
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (expr === 'HIGH' || expr === 'true') return 1;
    if (expr === 'LOW' || expr === 'false') return 0;
    if (!isNaN(Number(expr))) return Number(expr);

    const jsExpr = expr.replace(/\b(\w+)\b/g, match => {
      if (this.variables.hasOwnProperty(match)) return String(this.variables[match]);
      if (match === 'HIGH') return '1';
      if (match === 'LOW') return '0';
      return match;
    });

    try { return Function(`"use strict"; return (${jsExpr})`)(); }
    catch { return expr; }
  }

  private evalCondition(cond: string): boolean {
    return Boolean(this.evalExpr(cond));
  }
}
