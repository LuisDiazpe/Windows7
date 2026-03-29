importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');

let pyodide = null;

async function initPyodide() {
  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
  });
  console.log('WORKER VERSION 2 - RealTimeOutput activo');
  const sab = new SharedArrayBuffer(4 + 4096);
  const control = new Int32Array(sab, 0, 1);
  const dataBytes = new Uint8Array(sab, 4);

  self._sab_control = control;
  self._sab_data = dataBytes;

  pyodide.globals.set('_sab_control', control);
  pyodide.globals.set('_sab_data', dataBytes);

  await pyodide.runPythonAsync(`
import sys
import builtins

_ctrl = None
_data = None

def _init_sab(ctrl, data):
    global _ctrl, _data
    _ctrl = ctrl
    _data = data

def _sync_input(prompt=''):
    import js
    msg = js.Object.new()
    msg.type = 'input_request'
    msg.prompt = str(prompt) if prompt else ''
    js.postMessage(msg)
    _ctrl[0] = 0
    from js import Atomics
    Atomics.wait(_ctrl, 0, 0)
    chars = []
    i = 0
    while i < 4096 and _data[i] != 0:
        chars.append(chr(_data[i]))
        i += 1
    return ''.join(chars)

builtins.input = _sync_input

# Clase que emite cada línea en tiempo real al hilo principal
class _RealTimeOutput:
    def __init__(self, stream_type):
        self.stream_type = stream_type
        self._buf = ''

    def write(self, text):
        self._buf += text
        # Emitir línea por línea en tiempo real
        while '\\n' in self._buf:
            line, self._buf = self._buf.split('\\n', 1)
            import js
            msg = js.Object.new()
            msg.type = 'output'
            msg.text = line
            js.postMessage(msg)

    def flush(self):
        # Emitir lo que quede en el buffer sin salto de línea
        if self._buf:
            import js
            msg = js.Object.new()
            msg.type = 'output'
            msg.text = self._buf
            self._buf = ''
            js.postMessage(msg)

    def fileno(self):
        raise OSError("no fileno")

builtins._RealTimeOutput = _RealTimeOutput
  `);

  pyodide.runPython(`_init_sab(_sab_control, _sab_data)`);

  self.postMessage({ type: 'ready', sab: sab });
}

self.onmessage = async (e) => {
  const { type, code } = e.data;

  if (type === 'init') {
    await initPyodide();
    return;
  }

  if (type === 'run') {
    try {
      await pyodide.runPythonAsync(`
import sys
import builtins

# Instalar output en tiempo real
sys.stdout = builtins._RealTimeOutput('stdout')
sys.stderr = builtins._RealTimeOutput('stderr')

try:
${code.split('\n').map(l => '    ' + l).join('\n')}
except Exception as e:
    import traceback
    sys.stderr.write(traceback.format_exc())
finally:
    sys.stdout.flush()
    sys.stderr.flush()
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
      `);

      self.postMessage({ type: 'done' });
    } catch (e) {
      self.postMessage({ type: 'error', error: e.message });
    }
  }
};
