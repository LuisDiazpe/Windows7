export interface CppResult {
  output: string[];
  error?: string;
}

export class CppInterpreter {
  private variables: Record<string, any> = {};
  private functions: Record<string, { params: string[]; body: string }> = {};
  private output: string[] = [];

  execute(code: string): CppResult {
    this.variables = {};
    this.functions = {};
    this.output = [];

    try {
      // Remove comments
      code = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

      // Extract functions
      this.extractFunctions(code);

      // Find and run main
      if (this.functions['main']) {
        this.executeBlock(this.functions['main'].body);
      } else {
        throw new Error('No main() function found');
      }

      return { output: this.output };
    } catch (e: any) {
      return { output: this.output, error: e.message };
    }
  }

  private extractFunctions(code: string): void {
    const fnRegex = /(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = fnRegex.exec(code)) !== null) {
      const name = match[2];
      const params = match[3].split(',').map(p => p.trim().split(/\s+/).pop() || '');
      const start = match.index + match[0].length;
      const body = this.extractBlock(code, start);
      this.functions[name] = { params, body };
    }
  }

  private extractBlock(code: string, start: number): string {
    let depth = 1;
    let i = start;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      i++;
    }
    return code.slice(start, i - 1);
  }

  private executeBlock(code: string): void {
    const lines = code.split(';').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // cout
      if (line.includes('cout')) {
        this.execCout(line); continue;
      }

      // Variable declaration
      const declMatch = line.match(/^(int|float|double|string|char|bool|long)\s+(\w+)\s*(?:=\s*(.+))?$/);
      if (declMatch) {
        const varName = declMatch[2];
        const val = declMatch[3] ? this.evalExpr(declMatch[3]) : 0;
        this.variables[varName] = val;
        continue;
      }

      // Assignment
      const assignMatch = line.match(/^(\w+)\s*(?:\+=|-=|\*=|\/=|=)\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const op = line.includes('+=') ? '+=' : line.includes('-=') ? '-=' :
          line.includes('*=') ? '*=' : line.includes('/=') ? '/=' : '=';
        const val = this.evalExpr(assignMatch[2]);
        if (op === '=') this.variables[varName] = val;
        else if (op === '+=') this.variables[varName] = (this.variables[varName] || 0) + val;
        else if (op === '-=') this.variables[varName] = (this.variables[varName] || 0) - val;
        else if (op === '*=') this.variables[varName] = (this.variables[varName] || 0) * val;
        else if (op === '/=') this.variables[varName] = (this.variables[varName] || 0) / val;
        continue;
      }

      // For loop
      if (line.startsWith('for')) {
        this.execFor(line, lines, i); continue;
      }

      // While loop
      if (line.startsWith('while')) {
        this.execWhile(line, lines, i); continue;
      }

      // If statement
      if (line.startsWith('if')) {
        this.execIf(line, lines, i); continue;
      }

      // Return
      if (line.startsWith('return')) continue;
    }
  }

  private execCout(line: string): void {
    const parts = line.split('<<').slice(1);
    const result = parts.map(p => {
      p = p.trim();
      if (p === 'endl' || p === '"\\n"') return '\n';
      if (p.startsWith('"') && p.endsWith('"')) return p.slice(1, -1);
      return String(this.evalExpr(p));
    }).join('');
    result.split('\n').forEach(line => {
      if (line !== '') this.output.push(line);
    });
  }

  private execFor(line: string, lines: string[], idx: number): void {
    const match = line.match(/for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*(.+?)\s*;\s*(.+?)\s*;\s*(.+?)\s*\)/);
    if (!match) return;
    const varName = match[1];
    this.variables[varName] = this.evalExpr(match[2]);
    const cond = match[3];
    const inc = match[4];
    let iterations = 0;

    while (this.evalCondition(cond) && iterations < 10000) {
      // Execute the next block if available
      iterations++;
      if (inc.includes('++')) this.variables[varName]++;
      else if (inc.includes('--')) this.variables[varName]--;
      else {
        const m = inc.match(/(\w+)\s*([+\-*\/]=)\s*(.+)/);
        if (m) {
          const op = m[2];
          const val = this.evalExpr(m[3]);
          if (op === '+=') this.variables[m[1]] += val;
          else if (op === '-=') this.variables[m[1]] -= val;
        }
      }
    }
  }

  private execWhile(line: string, lines: string[], idx: number): void {
    const match = line.match(/while\s*\((.+)\)/);
    if (!match) return;
    let iterations = 0;
    while (this.evalCondition(match[1]) && iterations < 10000) {
      iterations++;
    }
  }

  private execIf(line: string, lines: string[], idx: number): void {
    const match = line.match(/if\s*\((.+)\)/);
    if (!match) return;
    // Basic if - just evaluate condition
    this.evalCondition(match[1]);
  }

  private evalExpr(expr: string): any {
    expr = expr.trim();
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (!isNaN(Number(expr))) return Number(expr);

    const jsExpr = expr.replace(/\b(\w+)\b/g, match => {
      if (this.variables.hasOwnProperty(match)) return String(this.variables[match]);
      return match;
    });

    try { return Function(`"use strict"; return (${jsExpr})`)(); }
    catch { return expr; }
  }

  private evalCondition(cond: string): boolean {
    return Boolean(this.evalExpr(cond));
  }
}
