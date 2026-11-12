'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

const PRESET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ALLOWED_HOSTS = new Set(['steamcommunity.com', 'store.steampowered.com']);
const IS_PORTABLE = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

let mainWindow = null;
let updateState = { status: 'idle', version: null, percent: null, error: null };
let updateCheckInFlight = false;

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:state', updateState);
  }
  return updateState;
}

function updateUnsupported(message) {
  setUpdateState({ status: 'unsupported', error: message, percent: null });
  return { ok: false, error: message };
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    return updateUnsupported('Update checks run in the installed app.');
  }
  if (IS_PORTABLE) {
    return updateUnsupported('Auto-updates work in the installed version, not the portable build.');
  }
  if (updateCheckInFlight) {
    return { ok: true, status: updateState.status, version: updateState.version };
  }
  if (['available', 'downloading', 'ready'].includes(updateState.status)) {
    return { ok: true, status: updateState.status, version: updateState.version };
  }

  updateCheckInFlight = true;
  setUpdateState({ status: 'checking', error: null, percent: null });
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      status: updateState.status,
      version: result?.updateInfo?.version ?? updateState.version,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState({ status: 'error', error: message, percent: null });
    return { ok: false, error: message };
  } finally {
    updateCheckInFlight = false;
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', error: null }));
  autoUpdater.on('update-available', (info) =>
    setUpdateState({ status: 'available', version: info.version, error: null }),
  );
  autoUpdater.on('update-not-available', (info) =>
    setUpdateState({ status: 'current', version: info.version, error: null }),
  );
  autoUpdater.on('download-progress', (progress) =>
    setUpdateState({ status: 'downloading', percent: progress.percent }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    setUpdateState({ status: 'ready', version: info.version, percent: 100 }),
  );
  autoUpdater.on('error', (error) =>
    setUpdateState({ status: 'error', error: error ? error.message : 'Update error.' }),
  );

  if (app.isPackaged && !IS_PORTABLE) {
    setTimeout(() => {
      void checkForUpdates();
    }, 8000);
    const timer = setInterval(() => {
      void checkForUpdates();
    }, 6 * 60 * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }
}

function presetDir() {
  return path.join(app.getPath('userData'), 'presets');
}

function isPreset(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      PRESET_ID.test(value.id) &&
      typeof value.name === 'string' &&
      value.name.trim().length > 0 &&
      value.name.length <= 80 &&
      value.loadout &&
      typeof value.loadout === 'object',
  );
}

function safeFileName(name) {
  const cleaned = String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || 'loadout';
}

async function readPresets() {
  const dir = presetDir();
  const entries = await fs.readdir(dir).catch(() => []);
  const presets = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf8'));
      if (isPreset(parsed)) presets.push(parsed);
    } catch {
      // Ignore unreadable or hand-edited files.
    }
  }
  presets.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return presets;
}

async function writePreset(preset) {
  await fs.mkdir(presetDir(), { recursive: true });
  await fs.writeFile(
    path.join(presetDir(), `${preset.id}.json`),
    `${JSON.stringify(preset, null, 2)}\n`,
    'utf8',
  );
}

function steamRoots() {
  const home = os.homedir();
  const roots = [];

  if (process.platform === 'win32') {
    roots.push(
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      'D:\\Steam',
      'D:\\SteamLibrary',
      'E:\\SteamLibrary',
    );
  } else if (process.platform === 'darwin') {
    roots.push(path.join(home, 'Library', 'Application Support', 'Steam'));
  } else {
    roots.push(
      path.join(home, '.steam', 'steam'),
      path.join(home, '.local', 'share', 'Steam'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
    );
  }

  const expanded = [];
  for (const root of roots) {
    if (!expanded.includes(root)) expanded.push(root);
    const vdf = path.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      const text = fsSync.readFileSync(vdf, 'utf8');
      for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) {
        const library = match[1].replace(/\\\\/g, '\\');
        if (!expanded.includes(library)) expanded.push(library);
      }
    } catch {
      // Steam may not be installed in this location.
    }
  }

  return expanded;
}

function workshopFolder() {
  for (const root of steamRoots()) {
    const candidate = path.join(root, 'steamapps', 'workshop', 'content', '252950');
    try {
      if (fsSync.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Try the next library.
    }
  }
  return null;
}

function isValidExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#080b0f',
    title: 'HITBOX — Rocket League Loadout Studio',
    autoHideMenuBar: true,
    icon: fsSync.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isValidExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (process.env.HITBOX_SMOKE === '1') {
    win.webContents.on('did-finish-load', () => {
      win.webContents
        .executeJavaScript(
          `(async () => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const shouldCheckUpdates = ${process.env.HITBOX_SMOKE_UPDATES === '1' ? 'true' : 'false'};
            await wait(350);
            const tabs = Array.from(document.querySelectorAll('.tab'));
            const result = [];
            for (const tab of tabs) {
              tab.click();
              await wait(160);
              result.push({
                tab: tab.textContent.replace(/[0-9]+$/, '').trim(),
                cars: document.querySelectorAll('.car-card').length,
                maps: document.querySelectorAll('.map-card').length,
                hitboxes: document.querySelectorAll('.hitbox-card').length,
                presets: document.querySelectorAll('.preset-card').length,
              });
            }
            let presetIpc = null;
            if (window.hitboxDesktop) {
              const saved = await window.hitboxDesktop.savePreset({
                id: 'smoke-test-preset',
                name: 'Smoke Test',
                loadout: { team: 'blue', carId: 'octane' },
              });
              const listed = await window.hitboxDesktop.listPresets();
              const removed = await window.hitboxDesktop.deletePreset('smoke-test-preset');
              presetIpc = {
                saved: saved.ok,
                listed: Boolean(listed.presets?.some((preset) => preset.id === 'smoke-test-preset')),
                removed: removed.ok,
              };
            }
            result.push({ tab: 'Preset IPC', ...presetIpc });

            tabs[0].click();
            await wait(180);
            if (!document.querySelector('.mod-toggle.on')) {
              document.querySelector('.mod-toggle')?.click();
              await wait(180);
            }
            document.querySelector('.mod-toggle')?.click();
            await wait(180);
            const toggleOff = Boolean(document.querySelector('.stage-off')) && !document.querySelector('.car-preview-svg');
            document.querySelector('.mod-toggle')?.click();
            await wait(180);
            const toggleOn = Boolean(document.querySelector('.car-preview-svg')) && !document.querySelector('.stage-off');
            result.push({ tab: 'Mod toggle', toggleOff, toggleOn });

            if (shouldCheckUpdates && window.hitboxDesktop) {
              const check = await window.hitboxDesktop.checkForUpdates();
              await wait(3000);
              const state = await window.hitboxDesktop.getUpdateState();
              result.push({ tab: 'Update check', check, state });
            }

            return result;
          })()`,
        )
        .then((info) => console.log(`[smoke] ${JSON.stringify(info)}`))
        .catch((error) => console.error('[smoke] check failed', error))
        .finally(() => setTimeout(() => app.quit(), 300));
    });
    win.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[smoke] load failed ${code} ${description} ${url}`);
      app.exit(1);
    });
  }

  return win;
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.hitbox.rl');
  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
          ],
        },
      });
    });
  }

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);

  ipcMain.handle('presets:list', async () => {
    try {
      return { ok: true, presets: await readPresets() };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('presets:save', async (_event, incoming) => {
    if (!incoming || typeof incoming !== 'object') {
      return { ok: false, error: 'Invalid preset.' };
    }
    const name = String(incoming.name || '').trim();
    if (!name) return { ok: false, error: 'Give the loadout a name first.' };
    if (name.length > 80) return { ok: false, error: 'Preset names are limited to 80 characters.' };

    const preset = {
      id:
        typeof incoming.id === 'string' && PRESET_ID.test(incoming.id)
          ? incoming.id
          : crypto.randomUUID(),
      name,
      updatedAt: new Date().toISOString(),
      loadout: incoming.loadout,
    };
    if (!isPreset(preset)) return { ok: false, error: 'Invalid loadout data.' };

    try {
      await writePreset(preset);
      return { ok: true, preset };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('presets:delete', async (_event, id) => {
    if (typeof id !== 'string' || !PRESET_ID.test(id)) {
      return { ok: false, error: 'Invalid preset id.' };
    }
    try {
      await fs.unlink(path.join(presetDir(), `${id}.json`));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('presets:export', async (event, incoming) => {
    if (!isPreset(incoming)) return { ok: false, error: 'Invalid preset.' };
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(window, {
      title: 'Export loadout preset',
      defaultPath: `${safeFileName(incoming.name)}.rlpreset.json`,
      filters: [{ name: 'Hitbox preset', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      await fs.writeFile(result.filePath, `${JSON.stringify(incoming, null, 2)}\n`, 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('presets:import', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: 'Import loadout preset',
      properties: ['openFile'],
      filters: [{ name: 'Hitbox preset', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };

    try {
      const parsed = JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'));
      if (!parsed || typeof parsed !== 'object' || !parsed.loadout) {
        return { ok: false, error: 'That file is not a Hitbox loadout preset.' };
      }
      let name = String(parsed.name || 'Imported loadout').trim().slice(0, 80);
      if (!name) name = 'Imported loadout';
      const preset = {
        id: crypto.randomUUID(),
        name,
        updatedAt: new Date().toISOString(),
        loadout: parsed.loadout,
      };
      await writePreset(preset);
      return { ok: true, preset };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('maps:openFolder', async () => {
    const folder = workshopFolder();
    if (!folder) {
      return {
        ok: false,
        error:
          'Could not find the Rocket League workshop folder. Open Steam → Rocket League → Workshop, subscribe to a map, then try again.',
      };
    }
    const error = await shell.openPath(folder);
    return error ? { ok: false, error } : { ok: true, path: folder };
  });

  ipcMain.handle('maps:openExternal', async (_event, url) => {
    if (!isValidExternal(url)) return { ok: false, error: 'Blocked link.' };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('game:launch', async () => {
    try {
      await shell.openExternal('steam://rungameid/252950');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('updates:state', () => updateState);
  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:install', () => {
    if (updateState.status !== 'ready') {
      return { ok: false, error: 'No update is ready to install yet.' };
    }
    setImmediate(() => autoUpdater.quitAndInstall());
    return { ok: true };
  });

  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
