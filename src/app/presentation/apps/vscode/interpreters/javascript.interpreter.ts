export interface JsResult {
  output: string[];
  error?: string;
}

export class JavaScriptInterpreter {
  private inputHandler: ((prompt: string) => Promise<string>) | null = null;
  private outputHandler: ((line: string) => void) | null = null;

  setInputHandler(handler: (prompt: string) => Promise<string>): void {
    this.inputHandler = handler;
  }

  setOutputHandler(handler: (line: string) => void): void {
    this.outputHandler = handler;
  }

  private emit(line: string): void {
    if (this.outputHandler) {
      this.outputHandler(line);
    }
  }

  async executeAsync(code: string): Promise<JsResult> {
    const output: string[] = [];

    const promptFn = async (msg: any): Promise<string> => {
      if (this.inputHandler) {
        return await this.inputHandler(String(msg));
      }
      return '';
    };

    const sandbox = this.buildSandbox(output, promptFn as any);

    try {
      const transformedCode = this.transformCode(code);

      const wrappedCode = `
        const prompt = __asyncPrompt__;
        ${transformedCode}
      `;

      const fn = new Function(
        ...Object.keys(sandbox),
        '__asyncPrompt__',
        `"use strict"; return (async () => { ${wrappedCode} })()`
      );

      await fn(...Object.values(sandbox), promptFn);
      return { output };
    } catch (e: any) {
      return { output, error: e.message };
    }
  }

  private transformCode(code: string): string {
    //hacer todas las funciones async
    let result = code
      .replace(/\bfunction\s+(\w+)\s*\(/g, 'async function $1(')
      .replace(/\bfunction\s*\(/g, 'async function (')
      .replace(/\b(const|let|var)\s+(\w+)\s*=\s*function\s*\(/g, '$1 $2 = async function (')
      .replace(/(\([\w\s,]*\))\s*=>\s*\{/g, 'async $1 => {');

    // inyectar await a prompt() fuera de strings
    result = this.injectAwaitToPrompt(result);

    //  await solo a funciones definidas por el usuario
    const fnNames: string[] = [];
    const fnRegex = /async function\s+(\w+)\s*\(/g;
    let match;
    while ((match = fnRegex.exec(result)) !== null) {
      fnNames.push(match[1]);
    }

    fnNames.forEach(name => {
      // Inyectar await a llamadas con o sin argumentos
      const callRegex = new RegExp(`(?<!await\\s)(?<!async function\\s)(?<!function\\s)\\b${name}\\s*\\(`, 'g');
      result = result.replace(callRegex, `await ${name}(`);
    });

    return result;
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

  execute(code: string): JsResult {
    const output: string[] = [];
    const sandbox = this.buildSandbox(output, (msg: any) => {
      output.push(`[prompt] ${msg}`);
      return '';
    });
    try {
      const fn = new Function(...Object.keys(sandbox), `"use strict";\n${code}`);
      fn(...Object.values(sandbox));
      return { output };
    } catch (e: any) {
      return { output, error: e.message };
    }
  }

  private buildSandbox(output: string[], promptFn: (msg: any) => string | Promise<string>): Record<string, any> {
    const emitLine = (line: string) => {
      output.push(line);
      this.emit(line);
    };

    return {
      console: {
        log: (...args: any[]) => emitLine(args.map(a => this.stringify(a)).join(' ')),
        error: (...args: any[]) => emitLine('ERROR: ' + args.map(a => this.stringify(a)).join(' ')),
        warn: (...args: any[]) => emitLine('WARN: ' + args.map(a => this.stringify(a)).join(' ')),
        info: (...args: any[]) => emitLine('INFO: ' + args.map(a => this.stringify(a)).join(' ')),
      },
      alert: (msg: any) => emitLine(`[alert] ${msg}`),
      prompt: promptFn,
      Math, JSON, Date, Array, Object, String, Number, Boolean,
      parseInt, parseFloat, isNaN, isFinite,
      setTimeout: () => {}, setInterval: () => {}, clearTimeout: () => {},
      clearInterval: () => {},
      fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
    };
  }

  private stringify(val: any): string {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') {
      try { return JSON.stringify(val, null, 2); } catch { return String(val); }
    }
    return String(val);
  }
}
