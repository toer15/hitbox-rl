import { useEffect, useRef, useState } from 'react';
import type { HitboxId, Loadout, Preset, UpdateState } from './types';
import { CARS, HITBOXES, WORKSHOP_MAPS, getCar } from './data';
import {
  DEFAULT_LOADOUT,
  exportPresetFile,
  getAppVersion,
  importPresetFile,
  launchGame,
  loadPresets,
  persistPreset,
  removePreset,
  sanitizeLoadout,
} from './lib/desktop';
import { Garage } from './components/Garage';
import { HitboxLab } from './components/HitboxLab';
import { Library } from './components/Library';
import { MapBrowser } from './components/MapBrowser';
import { Logo } from './components/Logo';
import { Icon } from './components/Icons';

type Tab = 'garage' | 'hitboxes' | 'maps' | 'library';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'garage', label: 'Garage' },
  { id: 'hitboxes', label: 'Hitboxes' },
  { id: 'maps', label: 'Mod maps' },
  { id: 'library', label: 'Library' },
];

const MOD_KEY = 'hitbox.modEnabled.v1';

function readModEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(MOD_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

interface ToastState {
  message: string;
  kind: 'ok' | 'error';
  key: number;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('garage');
  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);
  const [hitboxFilter, setHitboxFilter] = useState<HitboxId | 'all'>('all');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('Octane · Blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [version, setVersion] = useState('1.0.1');
  const [modEnabled, setModEnabled] = useState<boolean>(readModEnabled);
  const [launching, setLaunching] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    percent: null,
    error: null,
  });
  const lastUpdateStatus = useRef<UpdateState['status']>('idle');

  const car = getCar(loadout.carId) ?? CARS[0];
  const activePreset = editingId ? presets.find((preset) => preset.id === editingId) : undefined;
  const loadoutDirty = activePreset
    ? JSON.stringify(activePreset.loadout) !== JSON.stringify(loadout)
    : true;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [saved, appVersion] = await Promise.all([loadPresets(), getAppVersion()]);
      if (!alive) return;
      setPresets(saved);
      setVersion(appVersion);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MOD_KEY, String(modEnabled));
    } catch {
      // A blocked storage write should never take the app down.
    }
  }, [modEnabled]);

  useEffect(() => {
    const api = window.hitboxDesktop;
    if (!api) return;
    void api.getUpdateState().then(setUpdateState).catch(() => undefined);
    api.onUpdateState(setUpdateState);
  }, []);

  const notify = (message: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ message, kind, key: Date.now() });
  };

  useEffect(() => {
    const previous = lastUpdateStatus.current;
    lastUpdateStatus.current = updateState.status;
    if (previous === updateState.status) return;
    if (updateState.status === 'ready') {
      notify(`Update ${updateState.version ?? ''} downloaded. Restart to install it.`);
    } else if (updateState.status === 'available') {
      notify(`Update ${updateState.version ?? ''} found — downloading in the background.`);
    }
    // notify is intentionally only fired for completed/available updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState]);

  const updateLoadout = (patch: Partial<Loadout>) => {
    setLoadout((current) => ({ ...current, ...patch }));
  };

  const refreshPresets = async () => {
    setPresets(await loadPresets());
  };

  const saveLoadout = async (name: string) => {
    const result = await persistPreset(name, loadout, editingId);
    if (!result.ok) {
      notify(result.error ?? 'Could not save the preset.', 'error');
      return;
    }
    await refreshPresets();
    if (result.preset) {
      setEditingId(result.preset.id);
      setPresetName(result.preset.name);
    }
    notify(editingId ? 'Changes saved.' : 'Loadout saved to your library.');
  };

  const handleSave = () => saveLoadout(presetName);

  const handleQuickSave = () =>
    saveLoadout(editingId ? presetName : `${car.name} · ${loadout.team === 'blue' ? 'Blue' : 'Orange'}`);

  const handleNew = () => {
    setEditingId(null);
    setPresetName(`${car.name} · ${loadout.team === 'blue' ? 'Blue' : 'Orange'}`);
  };

  const handleExport = async () => {
    const preset: Preset = {
      id: editingId ?? crypto.randomUUID(),
      name: presetName.trim() || `${car.name} · ${loadout.team}`,
      updatedAt: new Date().toISOString(),
      loadout,
      enabled: modEnabled,
    };
    const result = await exportPresetFile(preset);
    if (result.canceled) return;
    if (!result.ok) {
      notify(result.error ?? 'Could not export the preset.', 'error');
      return;
    }
    notify('Preset exported as a .rlpreset.json file.');
  };

  const handleImport = async () => {
    const result = await importPresetFile();
    if (result.canceled) return;
    if (!result.ok || !result.preset) {
      notify(result.error ?? 'Could not import that preset.', 'error');
      return;
    }
    const imported = result.preset;
    await refreshPresets();
    setLoadout(sanitizeLoadout(imported.loadout));
    setEditingId(imported.id);
    setPresetName(imported.name);
    setTab('garage');
    notify(`Imported “${imported.name}”.`);
  };

  const handleLoad = (preset: Preset) => {
    setLoadout(sanitizeLoadout(preset.loadout));
    setEditingId(preset.id);
    setPresetName(preset.name);
    setTab('garage');
    notify(`Loaded “${preset.name}”.`);
  };

  const handleDelete = async (preset: Preset) => {
    if (!window.confirm(`Delete “${preset.name}”? This removes the local preset file.`)) return;
    const result = await removePreset(preset.id);
    if (!result.ok) {
      notify(result.error ?? 'Could not delete the preset.', 'error');
      return;
    }
    if (editingId === preset.id) {
      setEditingId(null);
      setPresetName(`${car.name} · ${loadout.team === 'blue' ? 'Blue' : 'Orange'}`);
    }
    await refreshPresets();
    notify('Preset deleted.');
  };

  const handleLaunch = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      const result = await launchGame();
      if (!result.ok) {
        notify(result.error ?? 'Could not launch Rocket League.', 'error');
        return;
      }
      const via =
        result.method === 'epic' ? ' through Epic' : result.method === 'steam' ? ' through Steam' : '';
      notify(`Opening Rocket League${via}…`);
    } finally {
      setLaunching(false);
    }
  };

  const updateLabel =
    updateState.status === 'checking'
      ? 'Checking…'
      : updateState.status === 'downloading'
        ? `Update ${Math.round(updateState.percent ?? 0)}%`
        : updateState.status === 'available'
          ? 'Downloading…'
        : updateState.status === 'ready'
          ? 'Restart update'
          : 'Check updates';

  const handleUpdate = async () => {
    const api = window.hitboxDesktop;
    if (!api) {
      notify('Update checks are available in the desktop build.', 'error');
      return;
    }
    if (updateState.status === 'ready') {
      const result = await api.installUpdate();
      if (!result.ok) notify(result.error ?? 'Could not restart for the update.', 'error');
      return;
    }
    const result = await api.checkForUpdates();
    if (!result.ok) notify(result.error ?? 'Could not check for updates.', 'error');
    else if (result.status === 'current') notify('You are on the latest version.');
  };

  const browseHitbox = (id: HitboxId) => {
    setHitboxFilter(id);
    setTab('garage');
  };

  const counts: Record<Tab, number> = {
    garage: CARS.length,
    hitboxes: HITBOXES.length,
    maps: WORKSHOP_MAPS.length,
    library: presets.length,
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <h1>HITBOX</h1>
            <span>RL loadout studio</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Sections">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              className={`tab ${tab === entry.id ? 'active' : ''}`}
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id ? 'page' : undefined}
            >
              {entry.label}
              <span className="count">{counts[entry.id]}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button
            className={`btn ghost update-btn ${updateState.status === 'ready' ? 'ready' : ''}`}
            onClick={handleUpdate}
            disabled={['checking', 'available', 'downloading'].includes(updateState.status)}
            title={
              updateState.error ??
              (updateState.status === 'ready'
                ? `Restart to install ${updateState.version ?? 'the update'}`
                : 'Check GitHub releases for a new version')
            }
            aria-label="Check for updates"
          >
            <Icon name={updateState.status === 'ready' ? 'download' : 'refresh'} size={13} />
            {updateLabel}
            {updateState.status === 'ready' && <span className="update-dot" />}
          </button>
          <button
            className={`mod-toggle ${modEnabled ? 'on' : 'off'}`}
            onClick={() => setModEnabled((value) => !value)}
            aria-pressed={modEnabled}
            title="Master switch for everything selected in Hitbox. Client-side only."
          >
            <span className="mod-led" />
            <span className="mod-copy">
              <b>Mod</b>
              <em>{modEnabled ? 'On' : 'Off'}</em>
            </span>
            <span className="mod-track">
              <i />
            </span>
          </button>
          <button className="btn ghost launch-btn" onClick={handleLaunch} disabled={launching}>
            <Icon name="play" size={13} />
            {launching ? 'Launching…' : 'Launch RL'}
          </button>
          <span className="version">v{version}</span>
        </div>
      </header>

      <main className="main">
        <div className="wrap">
          {tab === 'garage' && (
            <Garage
              loadout={loadout}
              modEnabled={modEnabled}
              onToggleMod={() => setModEnabled((value) => !value)}
              onChange={updateLoadout}
              presetName={presetName}
              onPresetNameChange={setPresetName}
              onSave={handleSave}
              onQuickSave={handleQuickSave}
              onExport={handleExport}
              onNew={handleNew}
              editing={Boolean(editingId)}
              dirty={loadoutDirty}
              hitboxFilter={hitboxFilter}
              onHitboxFilter={setHitboxFilter}
              onOpenHitboxLab={() => setTab('hitboxes')}
            />
          )}

          {tab === 'hitboxes' && <HitboxLab onBrowse={browseHitbox} />}

          {tab === 'maps' && <MapBrowser onNotify={notify} />}

          {tab === 'library' && (
            <Library
              presets={presets}
              onLoad={handleLoad}
              onDelete={handleDelete}
              onExport={async (preset) => {
                const result = await exportPresetFile({ ...preset, enabled: modEnabled });
                if (result.canceled) return;
                notify(
                  result.ok ? 'Preset exported.' : result.error ?? 'Could not export the preset.',
                  result.ok ? 'ok' : 'error',
                );
              }}
              onImport={handleImport}
              onGoToGarage={() => setTab('garage')}
            />
          )}

          <footer className="app-foot">
            <span>HITBOX v{version}</span>
            <span>Local presets · no injection · unofficial fan tool</span>
          </footer>
        </div>
      </main>

      {toast && (
        <div key={toast.key} className={`toast ${toast.kind}`} role="status">
          <Icon name={toast.kind === 'error' ? 'info' : 'check'} size={15} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
