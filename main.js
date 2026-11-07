/* ==========================================================================
   main.js — Hand Hygiene Watch desktop app (Electron)
   Real desktop window around the same static prototype: no server,
   no build step, index.html loaded straight from disk.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');

let win = null;

/* --- event log file: the Electron copy of the on-watch log ------------- */

function logPath() {
  return path.join(app.getPath('userData'), 'log.json');
}

/* --- on-device model: the renderer sends a prompt, main talks to
   Ollama on localhost and hands the raw text back. Aggregates only
   ever reach this point; validation and grounding happen in js/ai.js.
   Every failure is a value: the page falls back to its rules. */
function setupAIIPC() {
  let Ollama = null;
  try {
    Ollama = require('./ai/ollama.js');
  } catch (e) { /* packaged without the ai folder — rules only */ }
  ipcMain.handle('ai:query', async (_ev, prompt) => {
    try {
      if (!Ollama) return { ok: false, reason: 'no-model' };
      return await Ollama.query(String(prompt === undefined ? '' : prompt));
    } catch (e) {
      return { ok: false, reason: 'down' };
    }
  });
}

/* --- real watch: the page hands over an already-built push (title, one
   line, priority, kind). Shape is re-checked here so nothing else can ride
   along. Route 1: a phone on USB/Wi-Fi adb running the Hand Hygiene relay
   app (android/), offline, the watch mirrors its notification. Route 2:
   ntfy.sh. Failure is a value, never a throw. */
function setupWristIPC() {
  const { execFile } = require('child_process');
  const TOPIC_RE = /^[a-z0-9_-]{8,64}$/;
  const KINDS = ['reminder', 'doubtful', 'ok', 'end'];
  /* letters, digits, spaces and a few marks: safe inside the remote
     shell's single quotes, and all the watch font can draw anyway */
  const clean = (v, n) => String(v || '').replace(/·/g, '-')
    .replace(/[^A-Za-z0-9 ?.,:-]/g, '').slice(0, n).trim();

  function adb(args) {
    return new Promise((resolve) => {
      execFile('adb', args, { timeout: 4000 }, (err, out) =>
        resolve(err ? null : String(out)));
    });
  }

  async function viaPhone(title, body, kind) {
    const state = await adb(['get-state']);
    if (!state || state.trim() !== 'device') return false;
    const out = await adb(['shell',
      "am broadcast -n co.ucc.handhygiene/.NotifyReceiver -a co.ucc.handhygiene.NOTIFY" +
      " --es title '" + title + "' --es body '" + body + "' --es kind '" + kind + "'"]);
    return !!out && /result=0|Broadcast completed/.test(out);
  }

  /* --- the way back: the relay app logs "answer=yes|no" under the tag HHW
     (phone notification buttons, or the watch's music keys). Main tails that
     log over adb and hands each answer to the page. Started on first send. */
  let tail = null;
  /* logcat -T takes 'MM-DD hh:mm:ss.mmm': only answers from now on */
  function stamp() {
    const d = new Date(), p = (n, w = 2) => String(n).padStart(w, '0');
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' +
      p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
  }
  function listen() {
    if (tail) return;
    const { spawn } = require('child_process');
    adb(['shell', 'am start-foreground-service -n co.ucc.handhygiene/.RelayService']);
    tail = spawn('adb', ['logcat', '-T', stamp(), '-s', 'HHW:I'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    tail.stdout.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/answer=(yes|no)\b/);
        if (m && win && !win.isDestroyed()) win.webContents.send('wrist:answer', m[1]);
      }
    });
    tail.on('exit', () => { tail = null; });
  }
  app.on('will-quit', () => { if (tail) tail.kill(); });

  ipcMain.handle('wrist:send', async (_ev, topic, msg) => {
    try {
      if (!msg) return { ok: false };
      const title = clean(msg.title, 40);
      const body = clean(msg.body, 80);
      const kind = KINDS.includes(msg.kind) ? msg.kind : 'reminder';
      if (!title) return { ok: false };
      if (await viaPhone(title, body, kind)) { listen(); return { ok: true, route: 'phone' }; }
      if (!TOPIC_RE.test(String(topic))) return { ok: false };
      const priority = [1, 2, 3, 4, 5].includes(msg.priority) ? msg.priority : 3;
      const r = await fetch('https://ntfy.sh/' + topic, {
        method: 'POST',
        body,
        headers: { Title: title, Priority: String(priority) },
        signal: AbortSignal.timeout(4000)
      });
      return { ok: r.ok, route: 'ntfy' };
    } catch (e) {
      return { ok: false };
    }
  });
}

function setupLogIPC() {
  ipcMain.handle('log:load', async () => {
    try {
      return fs.readFileSync(logPath(), 'utf8');
    } catch (e) {
      return null; /* first run — no file yet */
    }
  });
  ipcMain.handle('log:save', async (_ev, json) => {
    try {
      if (typeof json === 'string' && json.length < 1024 * 1024) {
        fs.writeFileSync(logPath(), json, 'utf8');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 640,
    title: 'Hand Hygiene Watch',
    autoHideMenuBar: true,
    backgroundColor: '#101010',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  setupLogIPC();
  setupAIIPC();
  setupWristIPC();
  createWindow();

  /* Ctrl+Shift+L flips the same theme hook the toggle button uses */
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.executeJavaScript(
        'window.__toggleTheme && window.__toggleTheme()'
      ).catch(() => { /* page not ready yet */ });
    }
  });

  /* F11 fullscreen */
  globalShortcut.register('F11', () => {
    if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
