'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const https = require('node:https');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

const PRESET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ALLOWED_HOSTS = new Set(['steamcommunity.com', 'store.steampowered.com']);
const DOWNLOAD_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
  'bakkesmod.com',
  'api.steampowered.com',
]);
const BAKKESMOD_INSTALLER_URL =
  'https://github.com/bakkesmodorg/BakkesModInjectorCpp/releases/latest/download/BakkesModSetup.zip';
const HITBOX_REPO = 'toer15/hitbox-rl';
const BRIDGE_DLL_NAME = 'HitboxBridge.dll';

// ---------------------------------------------------------------------------
// Game bridge: detection, one-click installs and the live loadout file.
// ---------------------------------------------------------------------------

function homeAppData() {
  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
}

function defaultBakkesModFolder() {
  return path.join(homeAppData(), 'bakkesmod');
}

function bakkesModInstalled() {
  return fsSync.existsSync(path.join(defaultBakkesModFolder(), 'bakkesmod.exe')) ||
    fsSync.existsSync(path.join(defaultBakkesModFolder(), 'plugins'));
}

/** The plugin reports the real BakkesMod folder through a status file. */
function readBridgeStatus() {
  const statusPath = path.join(defaultBakkesModFolder(), 'hitbox_bridge.txt');
  try {
    const text = fsSync.readFileSync(statusPath, 'utf8');
    const fields = {};
    for (const line of text.split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq > 0) fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return fields;
  } catch {
    return {};
  }
}

function bridgeFolder() {
  const reported = readBridgeStatus().bmfolder;
  if (reported && fsSync.existsSync(reported)) return reported;
  return defaultBakkesModFolder();
}

function bridgePluginInstalled() {
  return fsSync.existsSync(path.join(bridgeFolder(), 'plugins', BRIDGE_DLL_NAME));
}

function fetchUrl(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) {
      reject(new Error('Too many redirects.'));
      return;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Bad URL.'));
      return;
    }
    if (!DOWNLOAD_HOSTS.has(parsed.hostname)) {
      reject(new Error(`Blocked download host: ${parsed.hostname}`));
      return;
    }
    const request = https.get(url, { headers: { 'User-Agent': 'HitboxApp' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        const location = response.headers.location;
        if (!location) {
          reject(new Error('Redirect without location.'));
          return;
        }
        resolve(fetchUrl(new URL(location, url).toString(), redirects - 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed (HTTP ${response.statusCode}).`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

function downloadToFile(url, destination) {
  return fetchUrl(url).then((buffer) => fs.writeFile(destination, buffer));
}

function runInstaller(filePath) {
  return new Promise((resolve) => {
    try {
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
      child.once('error', (error) => resolve({ ok: false, error: String(error) }));
      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error) });
    }
  });
}

async function extractZip(zipPath, destination) {
  await fs.mkdir(destination, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destination}' -Force`,
      ],
      { stdio: 'ignore' },
    );
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Expand-Archive exited with ${code}.`))));
  });
}

async function latestBridgeAsset() {
  const raw = await fetchUrl(`https://api.github.com/repos/${HITBOX_REPO}/releases/latest`);
  const release = JSON.parse(raw.toString('utf8'));
  const asset = (release.assets ?? []).find((entry) => entry.name === BRIDGE_DLL_NAME);
  if (!asset) throw new Error('The HitboxBridge.dll has not been published yet. Build it with the plugin workflow first.');
  return asset.browser_download_url;
}

async function writeLiveLoadout(live) {
  const folder = bridgeFolder();
  await fs.mkdir(path.join(folder, 'plugins'), { recursive: true });
  const lines = [
    `rev=${live.rev}`, `enabled=${live.enabled ? 1 : 0}`, `body=${live.bodyProductId}`,
    `boost=${live.boostProductId}`, `asis=${live.asIs ? 1 : 0}`,
  ];
  if (live.primary) lines.push(`primary=${live.primary}`);
  if (live.secondary) lines.push(`secondary=${live.secondary}`);
  const livePath = path.join(folder, 'hitbox_live.txt');
  await fs.writeFile(livePath, `${lines.join('\n')}\n`, 'utf8');
  return livePath;
}

async function readDumpedLoadout() {
  const dumpPath = path.join(bridgeFolder(), 'hitbox_dump.txt');
  try {
    const text = await fs.readFile(dumpPath, 'utf8');
    const slots = {};
    for (const line of text.split(/\r?\n/)) {
      const slot = line.match(/slot=(-?\d+)/);
      const product = line.match(/product=(\d+)/);
      if (slot && product) slots[Number(slot[1])] = Number(product[1]);
    }
    return { ok: true, slots, path: dumpPath };
  } catch {
    return { ok: false, error: 'No dump found. In game (freeplay), run the console command: hitbox_dumploadout' };
  }
}

function steamLookupWorkshop(id) {
  const body = `itemcount=1&publishedfileids%5B0%5D=${id}`;
  return new Promise((resolve) => {
    try {
      const request = https.request(
        {
          hostname: 'api.steampowered.com',
          path: '/ISteamRemoteStorage/GetPublishedFileDetails/v1/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const details = parsed.response?.publishedfiledetails?.[0];
              if (!details || details.result !== 1) {
                resolve({ ok: false, error: 'Workshop item not found.' });
                return;
              }
              resolve({
                ok: true,
                map: {
                  id: String(details.publishedfileid ?? id),
                  name: details.title ?? 'Workshop map',
                  author: details.creator ?? '',
                  sizeMB: Math.round((details.file_size ?? 0) / 1024 / 1024),
                  description: String(details.short_description ?? '').slice(0, 300),
                  previewUrl: details.preview_url ?? '',
                  subscriptions: details.subscriptions ?? 0,
                },
              });
            } catch (error) {
              resolve({ ok: false, error: String(error) });
            }
          });
        },
      );
      request.on('error', (error) => resolve({ ok: false, error: String(error) }));
      request.write(body);
      request.end();
    } catch (error) {
      resolve({ ok: false, error: String(error) });
    }
  });
}
const IS_PORTABLE = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const STEAM_LAUNCH_URI = 'steam://rungameid/252950';
const EPIC_LAUNCH_URI =
  'com.epicgames.launcher://apps/9773aa1aa54f4f7b80e44bef04986cea%3A530145df28a24424923f5828cc9031a1%3ASugar?action=launch&silent=true';
const EPIC_SHORT_URI = 'com.epicgames.launcher://apps/Sugar?action=launch&silent=true';

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
  autoUpdater.autoRunAppAfterInstall = true;
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

function rocketLeagueExecutable(root) {
  if (!root) return null;
  const candidates = [
    path.join(root, 'Binaries', 'Win64', 'RocketLeague.exe'),
    path.join(root, 'rocketleague', 'Binaries', 'Win64', 'RocketLeague.exe'),
    path.join(root, 'RocketLeague', 'Binaries', 'Win64', 'RocketLeague.exe'),
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate)) ?? null;
}

function findEpicRocketLeague() {
  const programData = process.env.ProgramData;
  if (programData) {
    const launcherData = path.join(programData, 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat');
    try {
      const parsed = JSON.parse(fsSync.readFileSync(launcherData, 'utf8'));
      for (const entry of parsed.InstallationList ?? []) {
        if (!entry || typeof entry.InstallLocation !== 'string') continue;
        if (entry.AppName === 'Sugar' || /rocket\s*league/i.test(entry.InstallLocation)) {
          const executable = rocketLeagueExecutable(entry.InstallLocation);
          if (executable) return executable;
        }
      }
    } catch {
      // Epic may not have written LauncherInstalled.dat yet.
    }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const roots = [
    path.join(programFiles, 'Epic Games', 'rocketleague'),
    path.join(programFiles, 'Epic Games', 'RocketLeague'),
    path.join(programFilesX86, 'Epic Games', 'rocketleague'),
    path.join(programFilesX86, 'Epic Games', 'RocketLeague'),
  ];
  for (const root of roots) {
    const executable = rocketLeagueExecutable(root);
    if (executable) return executable;
  }
  return null;
}

function findSteamRocketLeague() {
  for (const root of steamRoots()) {
    const executable = rocketLeagueExecutable(path.join(root, 'steamapps', 'common', 'rocketleague'));
    if (executable) return { executable, library: root };
    if (fsSync.existsSync(path.join(root, 'steamapps', 'appmanifest_252950.acf'))) {
      return { executable: null, library: root };
    }
  }
  return null;
}

/**
 * People install Rocket League in all kinds of places (D:\rocketleague,
 * D:\Games\..., custom Steam libraries...). Scan the usual drive shapes.
 */
function findDriveRocketLeague() {
  const drives = ['C:', 'D:', 'E:', 'F:'];
  const prefixes = [
    '',
    'Games',
    'Games\\',
    'Epic Games\\',
    'Steam\\steamapps\\common\\',
    'SteamLibrary\\steamapps\\common\\',
    'Games\\Steam\\steamapps\\common\\',
    'Games\\SteamLibrary\\steamapps\\common\\',
    'Program Files\\Epic Games\\',
    'Program Files (x86)\\Epic Games\\',
    'Steam Library\\steamapps\\common\\',
  ];
  const folderNames = ['rocketleague', 'Rocket League', 'RocketLeague'];
  for (const drive of drives) {
    for (const prefix of prefixes) {
      for (const folder of folderNames) {
        const candidate = `${drive}\\${prefix}${folder}\\Binaries\\Win64\\RocketLeague.exe`;
        try {
          if (fsSync.existsSync(candidate)) return candidate;
        } catch {
          // Unreadable drive letter; move on.
        }
      }
    }
  }
  return null;
}

function manualRocketLeagueFile() {
  return path.join(app.getPath('userData'), 'rocket-league-path.txt');
}

function readManualRocketLeague() {
  try {
    const exe = fsSync.readFileSync(manualRocketLeagueFile(), 'utf8').trim();
    if (exe && /RocketLeague\.exe$/i.test(exe) && fsSync.existsSync(exe)) return exe;
  } catch {
    // No manual pick saved yet.
  }
  return null;
}

function findAnyRocketLeague() {
  return (
    readManualRocketLeague() ??
    findEpicRocketLeague() ??
    findSteamRocketLeague()?.executable ??
    findDriveRocketLeague()
  );
}

function hasEpicLauncher() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return [
    path.join(programFiles, 'Epic Games', 'Launcher'),
    path.join(programFilesX86, 'Epic Games', 'Launcher'),
  ].some((root) => fsSync.existsSync(root));
}

function hasSteam() {
  return steamRoots().some((root) => fsSync.existsSync(path.join(root, 'steamapps')));
}

async function openProtocol(url) {
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
}

function launchExecutable(executable) {
  return new Promise((resolve) => {
    try {
      const child = spawn(executable, [], {
        cwd: path.dirname(executable),
        detached: true,
        stdio: 'ignore',
      });
      child.once('error', (error) => resolve({ ok: false, error: String(error) }));
      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true, method: 'executable', path: executable });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error) });
    }
  });
}

async function launchRocketLeague() {
  const epic = findEpicRocketLeague();
  if (epic) {
    if (await openProtocol(EPIC_LAUNCH_URI)) return { ok: true, method: 'epic', path: epic };
    if (await openProtocol(EPIC_SHORT_URI)) return { ok: true, method: 'epic', path: epic };
    const direct = await launchExecutable(epic);
    if (direct.ok) return direct;
  }

  const steam = findSteamRocketLeague();
  if (steam) {
    if (await openProtocol(STEAM_LAUNCH_URI)) {
      return { ok: true, method: 'steam', path: steam.executable ?? undefined };
    }
    if (steam.executable) {
      const direct = await launchExecutable(steam.executable);
      if (direct.ok) return direct;
    }
  }

  if (hasEpicLauncher()) {
    if (await openProtocol(EPIC_LAUNCH_URI)) return { ok: true, method: 'epic' };
    if (await openProtocol(EPIC_SHORT_URI)) return { ok: true, method: 'epic' };
  }
  if (hasSteam() && (await openProtocol(STEAM_LAUNCH_URI))) {
    return { ok: true, method: 'steam' };
  }

  return {
    ok: false,
    error:
      'Could not find Rocket League. Install it through Epic or Steam, or launch it once manually and try again.',
  };
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
                selectedCar: document.querySelector('.car-card.selected .car-name')?.textContent ?? null,
                carCheck: Boolean(document.querySelector('.car-card.selected .car-picked')),
                quickSave: Boolean(document.querySelector('.quick-save')),
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
  if (process.env.HITBOX_SMOKE === '1') {
    console.log(
      `[smoke] game detect ${JSON.stringify({ epic: findEpicRocketLeague(), steam: findSteamRocketLeague() })}`,
    );
  }
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

  ipcMain.handle('game:launch', () => launchRocketLeague());

  ipcMain.handle('setup:browseRocketLeague', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: 'Select RocketLeague.exe',
      properties: ['openFile'],
      filters: [{ name: 'Rocket League executable', extensions: ['exe'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    const exe = result.filePaths[0];
    if (!/RocketLeague\.exe$/i.test(exe)) {
      return { ok: false, error: 'That is not RocketLeague.exe. Pick the file inside Binaries\\Win64.' };
    }
    try {
      await fs.writeFile(manualRocketLeagueFile(), `${exe}\n`, 'utf8');
      return { ok: true, path: exe };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('setup:status', () => ({
    rocketLeague: findAnyRocketLeague(),
    bakkesMod: bakkesModInstalled(),
    bridgePlugin: bridgePluginInstalled(),
    bridgeFolder: bridgeFolder(),
    bridgeStatus: readBridgeStatus(),
  }));

  ipcMain.handle('setup:installBakkesMod', async () => {
    try {
      const tempZip = path.join(os.tmpdir(), 'BakkesModSetup.zip');
      await downloadToFile(BAKKESMOD_INSTALLER_URL, tempZip);
      const tempDir = path.join(os.tmpdir(), 'bakkesmod-setup');
      await extractZip(tempZip, tempDir);
      const entries = await fs.readdir(tempDir);
      const setup = entries.find((entry) => /setup\.exe$/i.test(entry));
      if (!setup) throw new Error('The BakkesMod installer did not extract a setup exe.');
      const result = await runInstaller(path.join(tempDir, setup));
      if (!result.ok) return result;
      return {
        ok: true,
        note: 'BakkesMod setup is running. Finish its wizard, then click Re-check here.',
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('setup:installPlugin', async () => {
    if (!bakkesModInstalled()) {
      return { ok: false, error: 'Install BakkesMod first (step 2).' };
    }
    try {
      const url = await latestBridgeAsset();
      const pluginsDir = path.join(bridgeFolder(), 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });
      await downloadToFile(url, path.join(pluginsDir, BRIDGE_DLL_NAME));
      return {
        ok: true,
        note: 'Bridge installed. Restart Rocket League (or press F5 in the BakkesMod console) to load it.',
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('bridge:apply', async (_event, live) => {
    if (!live || typeof live !== 'object') return { ok: false, error: 'Invalid live loadout.' };
    if (!bridgePluginInstalled()) {
      return { ok: false, error: 'The HITBOX bridge plugin is not installed yet (Setup).' };
    }
    try {
      const livePath = await writeLiveLoadout({
        rev: Date.now() % 1000000000,
        enabled: live.enabled === true,
        bodyProductId: Number(live.bodyProductId) || 0,
        boostProductId: Number(live.boostProductId) || 0,
        asIs: live.asIs === true,
        primary: typeof live.primary === 'string' && /^#[0-9a-fA-F]{6}$/.test(live.primary) ? live.primary : null,
        secondary: typeof live.secondary === 'string' && /^#[0-9a-fA-F]{6}$/.test(live.secondary) ? live.secondary : null,
      });
      return { ok: true, path: livePath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle('bridge:readDump', () => readDumpedLoadout());

  ipcMain.handle('bridge:openFolder', async () => {
    const error = await shell.openPath(bridgeFolder());
    return error ? { ok: false, error } : { ok: true, path: bridgeFolder() };
  });

  ipcMain.handle('maps:lookup', async (_event, id) => {
    if (typeof id !== 'string' || !/^\d{5,12}$/.test(id.trim())) {
      return { ok: false, error: 'Paste a Steam Workshop link or item number.' };
    }
    return steamLookupWorkshop(id.trim());
  });

  ipcMain.handle('updates:state', () => updateState);
  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:install', () => {
    if (updateState.status !== 'ready') {
      return { ok: false, error: 'No update is ready to install yet.' };
    }
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
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
