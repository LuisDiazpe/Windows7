export interface CppResult {
  output: string[];
  error?: string;
}

export class CppInterpreter {
  private outputHandler: ((line: string) => void) | null = null;
  private inputHandler: ((prompt: string) => Promise<string>) | null = null;

  private readonly JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com';
  private readonly RAPIDAPI_KEY = '1d3b05a535msh1e37d229f049dd1p1fb16ajsn4a406bbbb519';
  private readonly CPP_LANGUAGE_ID = 54;

  setOutputHandler(handler: (line: string) => void): void {
    this.outputHandler = handler;
  }

  setInputHandler(handler: (prompt: string) => Promise<string>): void {
    this.inputHandler = handler;
  }

  private emit(line: string): void {
    if (this.outputHandler) this.outputHandler(line);
  }

  private wrapCodeForInteractiveInput(code: string): string {
    const helper = `
#include <limits>
#include <sstream>
static bool __eof_hit = false;

template<typename T>
void __safe_cin_val(T& val) {
    if (__eof_hit) { std::cout << "__NEEDS_MORE_INPUT__" << std::endl; exit(0); }
    if (!(std::cin >> val)) {
        __eof_hit = true;
        std::cout << "__NEEDS_MORE_INPUT__" << std::endl;
        exit(0);
    }
}

void __safe_getline_val(std::istream& is, std::string& val) {
    if (__eof_hit) { std::cout << "__NEEDS_MORE_INPUT__" << std::endl; exit(0); }
    if (!std::getline(is, val)) {
        __eof_hit = true;
        std::cout << "__NEEDS_MORE_INPUT__" << std::endl;
        exit(0);
    }
}

void __safe_ignore() {
    if (!__eof_hit) {
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\\n');
    }
}

`;

    let result = code;
    const lastIncludeIdx = result.lastIndexOf('#include');
    if (lastIncludeIdx !== -1) {
      const endOfLine = result.indexOf('\n', lastIncludeIdx);
      result = result.slice(0, endOfLine + 1) + helper + result.slice(endOfLine + 1);
    } else {
      result = helper + result;
    }

    // Reemplazar getline(cin, var) ANTES de tocar cin >>
    result = result.replace(
      /\bgetline\s*\(\s*cin\s*,\s*(\w+)\s*\)/g,
      '__safe_getline_val(cin, $1)'
    );

    // Reemplazar cin.ignore(...)
    result = result.replace(
      /\bcin\.ignore\s*\([^)]*\)\s*;/g,
      '__safe_ignore();'
    );

    // Reemplazar cin >> expr encadenado
    // expr puede ser: variable simple (x), array con índice (v[i]), campo (obj.campo)
    // Capturar cada operando completo incluyendo [] y .
    result = result.replace(
      /(?<!::\s*)\bcin\s*((?:>>\s*(?:\w+(?:\[[\w\s+\-*\/]+\])*(?:\.\w+)*)\s*)+)/g,
      (match, chain) => {
        // Extraer cada operando completo: palabra + posible [índice] + posible .campo
        const operands: string[] = [];
        const opRegex = />>\s*((?:\w+(?:\[[\w\s+\-*\/]+\])*(?:\.\w+)*))/g;
        let m;
        while ((m = opRegex.exec(chain)) !== null) {
          operands.push(m[1].trim());
        }
        return operands.map(v => `__safe_cin_val(${v})`).join('; ');
      }
    );

    return result;
  }

  private extractInitialOutput(code: string): string[] {
    const codeLines = code.split('\n');
    const lines: string[] = [];

    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i].trim();
      if (/\bcin\s*>>/.test(line) || /getline\s*\(\s*cin/.test(line)) break;
      if (line.includes('cout')) {
        const match = line.match(/"([^"]*)"/);
        if (match) {
          const text = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t');
          text.split('\n').forEach(l => {
            if (l !== '') lines.push(l);
          });
        }
      }
    }
    return lines;
  }

  private normalize(s: string): string {
    return s.replace(/\r/g, '').replace(/[ \t]+$/gm, '');
  }

  private splitNewOutput(fullStdout: string, shownText: string): string[] {
    const normalFull = this.normalize(fullStdout);
    const normalShown = this.normalize(shownText);

    let newText = '';

    if (normalFull.startsWith(normalShown)) {
      newText = normalFull.slice(normalShown.length);
    } else {
      let commonLen = 0;
      const minLen = Math.min(normalFull.length, normalShown.length);
      while (commonLen < minLen && normalFull[commonLen] === normalShown[commonLen]) {
        commonLen++;
      }
      newText = normalFull.slice(commonLen);
    }

    // Saltar \n inicial si queda
    if (newText.startsWith('\n')) newText = newText.slice(1);

    return newText
      .split('\n')
      .map((l: string) => l.trimEnd())
      .filter((l: string) => l.trim() !== '');
  }

  async executeAsync(code: string): Promise<CppResult> {
    const output: string[] = [];

    try {
      this.emit('Compilando C++...');

      const needsInput = /\bcin\s*>>/.test(code) || /getline\s*\(\s*cin/.test(code);

      if (!needsInput || !this.inputHandler) {
        const result = await this.submitToJudge0(code, '', 5);
        if (!result) throw new Error('Timeout');

        const compileRaw = result.compile_output
          ? decodeURIComponent(escape(atob(result.compile_output))) : '';
        if (compileRaw.trim()) {
          compileRaw.split('\n').forEach((line: string) => {
            if (line.trim()) this.emit('Compile Error: ' + line);
          });
          return { output, error: 'Error de compilación' };
        }

        const stdoutRaw = result.stdout
          ? decodeURIComponent(escape(atob(result.stdout))) : '';
        stdoutRaw.split('\n').forEach((line: string) => {
          if (line !== '') { output.push(line); this.emit(line); }
        });

        const stderrRaw = result.stderr
          ? decodeURIComponent(escape(atob(result.stderr))) : '';
        if (stderrRaw.trim()) {
          stderrRaw.split('\n').forEach((line: string) => {
            if (line.trim()) this.emit('Error: ' + line);
          });
          return { output, error: 'Runtime Error' };
        }

        return { output };
      }

      const wrappedCode = this.wrapCodeForInteractiveInput(code);

      // Probe para verificar compilación
      const probeResult = await this.submitToJudge0(wrappedCode, '', 3);
      if (!probeResult) throw new Error('Timeout');

      const compileRaw = probeResult.compile_output
        ? decodeURIComponent(escape(atob(probeResult.compile_output))) : '';
      if (compileRaw.trim()) {
        compileRaw.split('\n').forEach((line: string) => {
          if (line.trim()) this.emit('Compile Error: ' + line);
        });
        return { output, error: 'Error de compilación' };
      }

      // Mostrar output inicial antes del primer cin
      const initialLines = this.extractInitialOutput(code);
      initialLines.forEach(line => {
        output.push(line);
        this.emit(line);
      });

      // shownText como string normalizado para comparar con stdout de Judge0
      let shownText = this.normalize(
        initialLines.join('\n') + (initialLines.length ? '\n' : '')
      );

      const collectedInputs: string[] = [];
      let finished = false;

      while (!finished) {
        const val = await this.inputHandler('');
        collectedInputs.push(val);

        const stdin = collectedInputs.join('\n') + '\n';
        const result = await this.submitToJudge0(wrappedCode, stdin, 5);

        if (!result) throw new Error('Timeout');

        const stdoutRaw = result.stdout
          ? decodeURIComponent(escape(atob(result.stdout))) : '';
        const stderrRaw = result.stderr
          ? decodeURIComponent(escape(atob(result.stderr))) : '';

        const needsMoreInput = stdoutRaw.includes('__NEEDS_MORE_INPUT__');

        // Normalizar y limpiar el marcador
        const cleanStdout = this.normalize(
          stdoutRaw.replace(/__NEEDS_MORE_INPUT__\n?/g, '').trimEnd()
        );

        const newLines = this.splitNewOutput(cleanStdout, shownText);

        if (newLines.length > 0) {
          newLines.forEach((line: string) => {
            output.push(line);
            this.emit(line);
          });
          // Actualizar shownText con el stdout completo normalizado actual
          shownText = cleanStdout;
          if (!shownText.endsWith('\n')) shownText += '\n';
        }

        if (needsMoreInput) {
          // Continuar pidiendo inputs

        } else if (result.status?.id === 3) {
          finished = true;

        } else if (result.status?.id === 4) {
          // TLE — continuar

        } else {
          if (stderrRaw.trim()) {
            stderrRaw.split('\n').forEach((line: string) => {
              if (line.trim()) this.emit('Error: ' + line);
            });
            return { output, error: 'Runtime Error' };
          }
          finished = true;
        }
      }

      return { output };

    } catch (e: any) {
      return { output, error: e.message };
    }
  }

  private async submitToJudge0(code: string, stdin: string, cpuLimit: number = 2): Promise<any> {
    const submitResponse = await fetch(
      `${this.JUDGE0_URL}/submissions?base64_encoded=true&wait=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': this.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
        body: JSON.stringify({
          language_id: this.CPP_LANGUAGE_ID,
          source_code: btoa(unescape(encodeURIComponent(code))),
          stdin: stdin ? btoa(unescape(encodeURIComponent(stdin))) : '',
          cpu_time_limit: cpuLimit,
          wall_time_limit: cpuLimit + 2,
          memory_limit: 128000,
        }),
      }
    );

    if (!submitResponse.ok) {
      throw new Error(`Judge0 error: ${submitResponse.status} ${submitResponse.statusText}`);
    }

    const { token } = await submitResponse.json();

    for (let attempts = 0; attempts < 20; attempts++) {
      await new Promise(r => setTimeout(r, 800));
      const res = await fetch(
        `${this.JUDGE0_URL}/submissions/${token}?base64_encoded=true`,
        {
          headers: {
            'X-RapidAPI-Key': this.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );
      const data = await res.json();
      if (data.status?.id > 2) return data;
    }

    return null;
  }

  execute(code: string): CppResult {
    return { output: [], error: 'Usa executeAsync para C++' };
  }
}
