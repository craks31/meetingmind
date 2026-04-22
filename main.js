const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  safeStorage,
  nativeTheme
} = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────
const KEY_FILE = path.join(app.getPath('userData'), 'key.enc');

// ── Helpers ───────────────────────────────────────────────────────────────
function saveKey(plaintext) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable');
  const buf = safeStorage.encryptString(plaintext);
  fs.writeFileSync(KEY_FILE, buf);
}

function loadKey() {
  if (!fs.existsSync(KEY_FILE)) return '';
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    const buf = fs.readFileSync(KEY_FILE);
    return safeStorage.decryptString(buf);
  } catch {
    return '';
  }
}

// ── Window ────────────────────────────────────────────────────────────────
let win;

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const W = 380, H = 520;
  const x = sw - W - 20;
  const y = sh - H - 20;

  win = new BrowserWindow({
    width:  W,
    height: H,
    x,
    y,
    minWidth:  320,
    minHeight: 380,
    transparent: true,
    frame:       false,
    alwaysOnTop: true,
    hasShadow:   false,
    resizable:   true,
    skipTaskbar: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // allow mic access
      additionalArguments: [],
    }
  });

  // ── Critical: hide from all screen capture software ───────────────────
  win.setContentProtection(true);

  // Force above fullscreen apps (screen-saver level)
  win.setAlwaysOnTop(true, 'screen-saver');

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Remove default menu bar
  win.setMenu(null);

  // Open DevTools only when MEETINGMIND_DEV=1 is set
  if (process.env.MEETINGMIND_DEV === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Allow microphone access in Electron >= 22+
  app.commandLine.appendSwitch('enable-features', 'AudioServiceOutOfProcess');

  createWindow();

  // Ctrl+Shift+M  →  toggle visibility
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// macOS: re-create window when dock icon clicked and no windows exist
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Windows/Linux: quit when all windows closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.handle('save-api-key', (_event, plaintext) => {
  try {
    saveKey(plaintext);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-api-key', () => {
  return loadKey();
});

ipcMain.handle('minimize-window', () => {
  win?.minimize();
});

ipcMain.handle('close-window', () => {
  win?.close();
});
