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
    return code.replace(
      /(cin(\s*>>\s*\w+)+)/g,
      (match) => `if (!(${match})) { std::cout << "\\n__NEEDS_MORE_INPUT__" << std::endl; exit(0); }`
    );
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

  // Compara carácter a carácter y retorna solo el texto nuevo
  private splitNewOutput(fullStdout: string, alreadyShownText: string): string[] {
    let newText = fullStdout;

    if (newText.startsWith(alreadyShownText)) {
      newText = newText.slice(alreadyShownText.length);
    } else {
      // Encontrar punto de divergencia carácter a carácter
      let commonLen = 0;
      const minLen = Math.min(newText.length, alreadyShownText.length);
      while (commonLen < minLen && newText[commonLen] === alreadyShownText[commonLen]) {
        commonLen++;
      }
      newText = newText.slice(commonLen);
    }

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

      // Código wrapeado para detectar EOF en cin
      const wrappedCode = this.wrapCodeForInteractiveInput(code);

      // Probe para verificar compilación solamente
      const probeResult = await this.submitToJudge0(wrappedCode, '\n', 3);
      if (!probeResult) throw new Error('Timeout');

      const compileRaw = probeResult.compile_output
        ? decodeURIComponent(escape(atob(probeResult.compile_output))) : '';
      if (compileRaw.trim()) {
        compileRaw.split('\n').forEach((line: string) => {
          if (line.trim()) this.emit('Compile Error: ' + line);
        });
        return { output, error: 'Error de compilación' };
      }

      // Mostrar output inicial (antes del primer cin)
      const initialLines = this.extractInitialOutput(code);
      initialLines.forEach(line => {
        output.push(line);
        this.emit(line);
      });

      // shownText es el texto acumulado ya mostrado como string
      // lo usamos para comparar con el stdout completo de Judge0
      let shownText = initialLines.join('\n') + (initialLines.length ? '\n' : '');

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
        const cleanStdout = stdoutRaw
          .replace(/__NEEDS_MORE_INPUT__\n?/g, '')
          .trimEnd();

        // Obtener solo las líneas nuevas comparando con texto ya mostrado
        const newLines = this.splitNewOutput(cleanStdout, shownText);

        // Mostrar líneas nuevas y actualizar shownText
        if (newLines.length > 0) {
          newLines.forEach((line: string) => {
            output.push(line);
            this.emit(line);
          });
          // shownText pasa a ser el stdout completo actual
          shownText = cleanStdout + '\n';
        }

        if (needsMoreInput) {
          // Continuar pidiendo inputs — no marcar finished

        } else if (result.status?.id === 3) {
          finished = true;

        } else if (result.status?.id === 4) {
          // TLE — continuar pidiendo inputs

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
