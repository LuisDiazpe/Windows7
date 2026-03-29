export interface PsintResult {
  output: string[];
  error?: string;
}

export class PsintInterpreter {
  private variables: Record<string, any> = {};
  private output: string[] = [];
  private lines: string[] = [];
  private pos = 0;
  private maxIterations = 10000;
  private inputHandler: ((prompt: string) => Promise<string>) | null = null;
  private outputHandler: ((line: string) => void) | null = null;

  setInputHandler(handler: (prompt: string) => Promise<string>): void {
    this.inputHandler = handler;
  }

  setOutputHandler(handler: (line: string) => void): void {
    this.outputHandler = handler;
  }

  async executeAsync(code: string): Promise<PsintResult> {
    this.variables = {};
    this.output = [];
    this.lines = code.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//'));
    this.pos = 0;

    try {
      while (this.pos < this.lines.length) {
        await this.executeLineAsync();
      }
      return { output: this.output };
    } catch (e: any) {
      return { output: this.output, error: e.message };
    }
  }

  execute(code: string): PsintResult {
    this.variables = {};
    this.output = [];
    this.lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    this.pos = 0;
    try {
      while (this.pos < this.lines.length) {
        this.executeLineSync();
      }
      return { output: this.output };
    } catch (e: any) {
      return { output: this.output, error: e.message };
    }
  }

  private emit(line: string): void {
    this.output.push(line);
    if (this.outputHandler) this.outputHandler(line);
  }

  private async executeLineAsync(): Promise<void> {
    const line = this.lines[this.pos];
    if (!line) { this.pos++; return; }
    const upper = line.toUpperCase();

    if (this.isStructureKeyword(upper)) { this.pos++; return; }
    if (upper.startsWith('ESCRIBIR ') || upper.startsWith('IMPRIMIR ') || upper.startsWith('MOSTRAR ')) {
      this.execEscribirEmit(line); return;
    }
    if (upper.startsWith('LEER ')) { await this.execLeerAsync(line); return; }
    if (upper.startsWith('SI ') || upper === 'SI') { await this.execSiAsync(); return; }
    if (upper.startsWith('SEGUN ') || upper.startsWith('SEGÚN ')) { await this.execSegunAsync(); return; }
    if (upper.startsWith('PARA ')) { await this.execParaAsync(); return; }
    if (upper.startsWith('MIENTRAS ')) { await this.execMientrasAsync(); return; }
    if (upper.startsWith('REPETIR')) { await this.execRepetirAsync(); return; }
    if (upper.startsWith('DEFINIR ')) { this.execDefinir(line); this.pos++; return; }
    if (line.includes('<-') || line.includes(':=')) { this.execAsignacion(line); this.pos++; return; }
    if (upper.startsWith('FUNCION ') || upper.startsWith('SUBPROCESO ')) {
      this.skipBlock('FINFUNCION', 'FINSUBPROCESO'); return;
    }
    this.pos++;
  }

  private executeLineSync(): void {
    const line = this.lines[this.pos];
    if (!line) { this.pos++; return; }
    const upper = line.toUpperCase();

    if (this.isStructureKeyword(upper)) { this.pos++; return; }
    if (upper.startsWith('ESCRIBIR ') || upper.startsWith('IMPRIMIR ') || upper.startsWith('MOSTRAR ')) {
      this.execEscribirEmit(line); return;
    }
    if (upper.startsWith('LEER ')) { this.execLeerSync(line); return; }
    if (upper.startsWith('SI ') || upper === 'SI') { this.execSiSync(); return; }
    if (upper.startsWith('SEGUN ') || upper.startsWith('SEGÚN ')) { this.execSegunSync(); return; }
    if (upper.startsWith('PARA ')) { this.execParaSync(); return; }
    if (upper.startsWith('MIENTRAS ')) { this.execMientrasSync(); return; }
    if (upper.startsWith('DEFINIR ')) { this.execDefinir(line); this.pos++; return; }
    if (line.includes('<-') || line.includes(':=')) { this.execAsignacion(line); this.pos++; return; }
    this.pos++;
  }

  private isStructureKeyword(upper: string): boolean {
    return ['INICIO', 'FIN', 'FINALGORITMO', 'FINPROCESO', 'FINFUNCION',
      'FINSUBPROCESO', 'ALGORITMO', 'PROCESO'].some(k =>
      upper === k || upper.startsWith(k + ' ')
    );
  }

  private execEscribirEmit(line: string): void {
    const content = line.replace(/^(escribir|imprimir|mostrar)\s+/i, '');
    const parts = content.split(',');
    const result = parts.map(p => this.evalExpr(p.trim())).join(' ');
    this.emit(result);
    this.pos++;
  }

  private async execLeerAsync(line: string): Promise<void> {
    const varName = line.replace(/^leer\s+/i, '').trim();
    const prompt = `${varName}: `;
    const value = this.inputHandler
      ? await this.inputHandler(prompt)
      : '0';
    const num = Number(value);
    this.variables[varName.toLowerCase()] = isNaN(num) ? value : num;
    this.pos++;
  }

  private execLeerSync(line: string): void {
    const varName = line.replace(/^leer\s+/i, '').trim();
    this.variables[varName.toLowerCase()] = '0';
    this.pos++;
  }

  private async execSiAsync(): Promise<void> {
    const line = this.lines[this.pos];
    const condStr = line.replace(/^si\s+/i, '').replace(/\s+entonces\s*$/i, '').trim();
    const cond = this.evalCondition(condStr);
    this.pos++;

    const trueBlock: string[] = [];
    const falseBlock: string[] = [];
    let inElse = false;
    let depth = 0;

    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('SI ') || l === 'SI') depth++;
      if (l === 'FINSI' || l === 'FIN SI') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      if ((l === 'SINO' || l === 'SI NO') && depth === 0) {
        inElse = true; this.pos++; continue;
      }
      if (inElse) falseBlock.push(this.lines[this.pos]);
      else trueBlock.push(this.lines[this.pos]);
      this.pos++;
    }

    const blockToRun = cond ? trueBlock : falseBlock;
    if (blockToRun.length > 0) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      sub.setInputHandler(this.inputHandler!);
      sub.setOutputHandler(this.outputHandler!);
      const result = await sub.executeAsync(blockToRun.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
    }
  }

  private execSiSync(): void {
    const line = this.lines[this.pos];
    const condStr = line.replace(/^si\s+/i, '').replace(/\s+entonces\s*$/i, '').trim();
    const cond = this.evalCondition(condStr);
    this.pos++;

    const trueBlock: string[] = [];
    const falseBlock: string[] = [];
    let inElse = false;
    let depth = 0;

    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('SI ') || l === 'SI') depth++;
      if (l === 'FINSI' || l === 'FIN SI') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      if ((l === 'SINO' || l === 'SI NO') && depth === 0) {
        inElse = true; this.pos++; continue;
      }
      if (inElse) falseBlock.push(this.lines[this.pos]);
      else trueBlock.push(this.lines[this.pos]);
      this.pos++;
    }

    const blockToRun = cond ? trueBlock : falseBlock;
    if (blockToRun.length > 0) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      const result = sub.execute(blockToRun.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
    }
  }

  private async execSegunAsync(): Promise<void> {
    const line = this.lines[this.pos];
    const varStr = line.replace(/^seg[uú]n\s+/i, '').replace(/\s+hacer\s*$/i, '').trim();
    const varVal = this.evalExpr(varStr);
    this.pos++;

    const cases: Record<string, string[]> = {};
    let defaultBlock: string[] = [];
    let currentCase: string | null = null;
    let depth = 0;

    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos];
      const upper = l.toUpperCase().trim();

      if (upper.startsWith('SEGUN ') || upper.startsWith('SEGÚN ')) depth++;

      if (upper === 'FINSEGUN' || upper === 'FIN SEGUN' || upper === 'FIN SEGÚN') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }

      if (depth === 0) {
        const caseMatch = l.match(/^(\d+|".+?"|'.+?')\s*:/);
        if (caseMatch) {
          currentCase = caseMatch[1].replace(/['"]/g, '');
          cases[currentCase] = [];
          this.pos++; continue;
        }

        if (upper.startsWith('DE OTRO MODO') || upper.startsWith('DEOTROMODO') || upper === 'SINO:') {
          currentCase = '__default__';
          defaultBlock = [];
          this.pos++; continue;
        }
      }

      if (currentCase === '__default__') defaultBlock.push(l);
      else if (currentCase !== null) cases[currentCase].push(l);
      this.pos++;
    }

    const matchKey = String(varVal);
    const blockToRun = cases[matchKey] || defaultBlock;

    if (blockToRun.length > 0) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      sub.setInputHandler(this.inputHandler!);
      sub.setOutputHandler(this.outputHandler!);
      const result = await sub.executeAsync(blockToRun.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
    }
  }

  private execSegunSync(): void {
    const line = this.lines[this.pos];
    const varStr = line.replace(/^seg[uú]n\s+/i, '').replace(/\s+hacer\s*$/i, '').trim();
    const varVal = this.evalExpr(varStr);
    this.pos++;

    const cases: Record<string, string[]> = {};
    let defaultBlock: string[] = [];
    let currentCase: string | null = null;
    let depth = 0;

    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos];
      const upper = l.toUpperCase().trim();
      if (upper.startsWith('SEGUN ') || upper.startsWith('SEGÚN ')) depth++;
      if (upper === 'FINSEGUN' || upper === 'FIN SEGUN' || upper === 'FIN SEGÚN') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      if (depth === 0) {
        const caseMatch = l.match(/^(\d+|".+?"|'.+?')\s*:/);
        if (caseMatch) {
          currentCase = caseMatch[1].replace(/['"]/g, '');
          cases[currentCase] = [];
          this.pos++; continue;
        }
        if (upper.startsWith('DE OTRO MODO') || upper === 'SINO:') {
          currentCase = '__default__';
          defaultBlock = [];
          this.pos++; continue;
        }
      }
      if (currentCase === '__default__') defaultBlock.push(l);
      else if (currentCase !== null) cases[currentCase].push(l);
      this.pos++;
    }

    const matchKey = String(varVal);
    const blockToRun = cases[matchKey] || defaultBlock;
    if (blockToRun.length > 0) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      const result = sub.execute(blockToRun.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
    }
  }

  private async execParaAsync(): Promise<void> {
    const line = this.lines[this.pos];
    const match = line.match(/para\s+(\w+)\s*<-\s*(.+)\s+hasta\s+(.+?)(\s+paso\s+(.+))?\s*hacer?/i);
    if (!match) { this.pos++; return; }

    const varName = match[1].toLowerCase();
    let from = Number(this.evalExpr(match[2]));
    const to = Number(this.evalExpr(match[3]));
    const step = match[5] ? Number(this.evalExpr(match[5])) : 1;
    this.pos++;

    const body: string[] = [];
    let depth = 0;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('PARA ')) depth++;
      if (l === 'FINPARA' || l === 'FIN PARA') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      body.push(this.lines[this.pos]);
      this.pos++;
    }

    let iterations = 0;
    while ((step > 0 ? from <= to : from >= to) && iterations < this.maxIterations) {
      this.variables[varName] = from;
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      sub.setInputHandler(this.inputHandler!);
      sub.setOutputHandler(this.outputHandler!);
      const result = await sub.executeAsync(body.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
      from += step;
      iterations++;
    }
  }

  private execParaSync(): void {
    const line = this.lines[this.pos];
    const match = line.match(/para\s+(\w+)\s*<-\s*(.+)\s+hasta\s+(.+?)(\s+paso\s+(.+))?\s*hacer?/i);
    if (!match) { this.pos++; return; }

    const varName = match[1].toLowerCase();
    let from = Number(this.evalExpr(match[2]));
    const to = Number(this.evalExpr(match[3]));
    const step = match[5] ? Number(this.evalExpr(match[5])) : 1;
    this.pos++;

    const body: string[] = [];
    let depth = 0;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('PARA ')) depth++;
      if (l === 'FINPARA' || l === 'FIN PARA') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      body.push(this.lines[this.pos]);
      this.pos++;
    }

    let iterations = 0;
    while ((step > 0 ? from <= to : from >= to) && iterations < this.maxIterations) {
      this.variables[varName] = from;
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      const result = sub.execute(body.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
      from += step;
      iterations++;
    }
  }

  private async execMientrasAsync(): Promise<void> {
    const line = this.lines[this.pos];
    const condStr = line.replace(/^mientras\s+/i, '').replace(/\s+hacer\s*$/i, '').trim();
    this.pos++;

    const body: string[] = [];
    let depth = 0;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('MIENTRAS ')) depth++;
      if (l === 'FINMIENTRAS' || l === 'FIN MIENTRAS') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      body.push(this.lines[this.pos]);
      this.pos++;
    }

    let iterations = 0;
    while (this.evalCondition(condStr) && iterations < this.maxIterations) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      sub.setInputHandler(this.inputHandler!);
      sub.setOutputHandler(this.outputHandler!);
      const result = await sub.executeAsync(body.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
      iterations++;
    }
  }

  private execMientrasSync(): void {
    const line = this.lines[this.pos];
    const condStr = line.replace(/^mientras\s+/i, '').replace(/\s+hacer\s*$/i, '').trim();
    this.pos++;

    const body: string[] = [];
    let depth = 0;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('MIENTRAS ')) depth++;
      if (l === 'FINMIENTRAS' || l === 'FIN MIENTRAS') {
        if (depth === 0) { this.pos++; break; }
        depth--;
      }
      body.push(this.lines[this.pos]);
      this.pos++;
    }

    let iterations = 0;
    while (this.evalCondition(condStr) && iterations < this.maxIterations) {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      const result = sub.execute(body.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      iterations++;
    }
  }

  private async execRepetirAsync(): Promise<void> {
    this.pos++;
    const body: string[] = [];
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (l.startsWith('HASTA QUE') || l.startsWith('HASTAQUE')) break;
      body.push(this.lines[this.pos]);
      this.pos++;
    }
    const condLine = this.lines[this.pos] || '';
    const condStr = condLine.replace(/^hasta\s+que\s+/i, '').trim();
    this.pos++;

    let iterations = 0;
    do {
      const sub = new PsintInterpreter();
      sub.variables = { ...this.variables };
      sub.setInputHandler(this.inputHandler!);
      sub.setOutputHandler(this.outputHandler!);
      const result = await sub.executeAsync(body.join('\n'));
      this.output.push(...result.output);
      Object.assign(this.variables, sub.variables);
      if (result.error) throw new Error(result.error);
      iterations++;
    } while (!this.evalCondition(condStr) && iterations < this.maxIterations);
  }

  private execDefinir(line: string): void {
    const match = line.match(/definir\s+(.+)\s+como\s+(.+)/i);
    if (match) {
      const vars = match[1].split(',').map(v => v.trim());
      vars.forEach(v => {
        const type = match[2].toLowerCase();
        this.variables[v.toLowerCase()] = type.includes('entero') || type.includes('real') ? 0 : '';
      });
    }
  }

  private execAsignacion(line: string): void {
    const sep = line.includes('<-') ? '<-' : ':=';
    const [varPart, valPart] = line.split(sep);
    const varName = varPart.trim().toLowerCase();
    this.variables[varName] = this.evalExpr(valPart.trim());
  }

  private skipBlock(...ends: string[]): void {
    this.pos++;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos].toUpperCase();
      if (ends.some(e => l === e || l.startsWith(e))) { this.pos++; break; }
      this.pos++;
    }
  }

  private evalExpr(expr: string): any {
    expr = expr.trim();
    if ((expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }
    if (!isNaN(Number(expr))) return Number(expr);
    if (expr.toUpperCase() === 'VERDADERO' || expr.toUpperCase() === 'TRUE') return true;
    if (expr.toUpperCase() === 'FALSO' || expr.toUpperCase() === 'FALSE') return false;

    if (/^raiz\s*\(/i.test(expr)) return Math.sqrt(Number(this.evalExpr(expr.replace(/^raiz\s*\(/i, '').slice(0, -1))));
    if (/^abs\s*\(/i.test(expr)) return Math.abs(Number(this.evalExpr(expr.replace(/^abs\s*\(/i, '').slice(0, -1))));
    if (/^redondear\s*\(/i.test(expr)) return Math.round(Number(this.evalExpr(expr.replace(/^redondear\s*\(/i, '').slice(0, -1))));
    if (/^longitud\s*\(/i.test(expr)) return String(this.evalExpr(expr.replace(/^longitud\s*\(/i, '').slice(0, -1))).length;
    if (/^azar\s*\(/i.test(expr)) return Math.floor(Math.random() * Number(this.evalExpr(expr.replace(/^azar\s*\(/i, '').slice(0, -1))));
    if (/^mayusculas\s*\(/i.test(expr)) return String(this.evalExpr(expr.replace(/^mayusculas\s*\(/i, '').slice(0, -1))).toUpperCase();
    if (/^minusculas\s*\(/i.test(expr)) return String(this.evalExpr(expr.replace(/^minusculas\s*\(/i, '').slice(0, -1))).toLowerCase();
    if (/^subcadena\s*\(/i.test(expr)) {
      const args = expr.replace(/^subcadena\s*\(/i, '').slice(0, -1).split(',');
      return String(this.evalExpr(args[0])).substring(Number(this.evalExpr(args[1])), Number(this.evalExpr(args[2])));
    }

    const jsExpr = expr
      .replace(/\bMOD\b/gi, '%')
      .replace(/\bY\b/gi, '&&')
      .replace(/\bO\b/gi, '||')
      .replace(/\bNO\b/gi, '!')
      .replace(/<>/g, '!==')
      .replace(/(?<![<>!])=(?!=)/g, '===')
      .replace(/\b(\w+)\b/g, (match) => {
        const lower = match.toLowerCase();
        if (this.variables.hasOwnProperty(lower)) {
          const val = this.variables[lower];
          return typeof val === 'string' ? `"${val}"` : String(val);
        }
        return match;
      });

    try { return Function(`"use strict"; return (${jsExpr})`)(); }
    catch { return expr; }
  }

  private evalCondition(condStr: string): boolean {
    return Boolean(this.evalExpr(condStr));
  }
}
