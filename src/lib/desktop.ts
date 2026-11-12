import type { DesktopResult, Loadout, Preset, VelocitySwapItem } from '../types';
import { CAR_PRODUCT_IDS, BOOST_PRODUCT_IDS } from '../data/productIds';
import { isHex, normalizeHex } from './color';
import { slugify } from './slug';

const PRESET_KEY = 'hitbox.presets.v1';

export const DEFAULT_LOADOUT: Loadout = {
  team: 'blue',
  carId: 'octane',
  boostId: 'standard',
  primary: '#2E7FE6',
  secondary: '#DFE9F5',
  finishPrimary: 'glossy',
  finishSecondary: 'glossy',
  stockPaint: true,
};

/** Presets can come from disk or another person, so never trust their shape. */
export function sanitizeLoadout(value: unknown): Loadout {
  const next: Loadout = { ...DEFAULT_LOADOUT };
  if (!value || typeof value !== 'object') return next;

  const raw = value as Record<string, unknown>;
  if (raw.team === 'blue' || raw.team === 'orange') next.team = raw.team;
  if (typeof raw.carId === 'string') next.carId = raw.carId;
  if (raw.boostId === null) next.boostId = null;
  else if (typeof raw.boostId === 'string') next.boostId = raw.boostId;
  if (typeof raw.primary === 'string' && isHex(raw.primary)) next.primary = normalizeHex(raw.primary);
  if (typeof raw.secondary === 'string' && isHex(raw.secondary)) {
    next.secondary = normalizeHex(raw.secondary);
  }
  if (typeof raw.finishPrimary === 'string') next.finishPrimary = raw.finishPrimary;
  if (typeof raw.finishSecondary === 'string') next.finishSecondary = raw.finishSecondary;
  if (typeof raw.stockPaint === 'boolean') next.stockPaint = raw.stockPaint;
  return next;
}

function sanitizePreset(preset: Preset): Preset {
  return {
    id: preset.id,
    name: (typeof preset.name === 'string' ? preset.name : 'Imported loadout').slice(0, 80),
    updatedAt: typeof preset.updatedAt === 'string' ? preset.updatedAt : new Date().toISOString(),
    loadout: sanitizeLoadout(preset.loadout),
    ...(typeof preset.enabled === 'boolean' ? { enabled: preset.enabled } : {}),
  };
}

function bridge() {
  return window.hitboxDesktop;
}

function readLocal(): Preset[] {
  try {
    const raw = window.localStorage.getItem(PRESET_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is Preset => Boolean(item?.id && item?.name && item?.loadout)) : [];
  } catch {
    return [];
  }
}

function writeLocal(presets: Preset[]) {
  window.localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

export async function getAppVersion(): Promise<string> {
  try {
    return (await bridge()?.version()) ?? '1.0.2';
  } catch {
    return '1.0.2';
  }
}

export async function loadPresets(): Promise<Preset[]> {
  const api = bridge();
  if (api) {
    const result = await api.listPresets();
    if (result.ok) return (result.presets ?? []).map(sanitizePreset);
  }
  return readLocal().map(sanitizePreset);
}

export async function persistPreset(
  name: string,
  loadout: Loadout,
  id: string | null,
): Promise<DesktopResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Give the loadout a name first.' };

  const api = bridge();
  if (api) {
    return api.savePreset({
      id: id ?? crypto.randomUUID(),
      name: trimmed,
      updatedAt: new Date().toISOString(),
      loadout,
    });
  }

  const preset: Preset = {
    id: id ?? crypto.randomUUID(),
    name: trimmed,
    updatedAt: new Date().toISOString(),
    loadout,
  };
  const presets = readLocal();
  const index = presets.findIndex((item) => item.id === preset.id);
  if (index >= 0) presets[index] = preset;
  else presets.unshift(preset);
  writeLocal(presets);
  return { ok: true, preset };
}

export async function removePreset(id: string): Promise<DesktopResult> {
  const api = bridge();
  if (api) return api.deletePreset(id);

  writeLocal(readLocal().filter((preset) => preset.id !== id));
  return { ok: true };
}

export async function exportPresetFile(preset: Preset): Promise<DesktopResult> {
  const api = bridge();
  if (api) return api.exportPreset(preset);

  const blob = new Blob([`${JSON.stringify(preset, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(preset.name) || 'loadout'}.rlpreset.json`;
  link.click();
  URL.revokeObjectURL(url);
  return { ok: true, path: link.download };
}

export async function importPresetFile(): Promise<DesktopResult> {
  const api = bridge();
  if (!api) return { ok: false, error: 'Importing preset files is available in the desktop build.' };
  return api.importPreset();
}

export async function openExternal(url: string): Promise<DesktopResult> {
  const api = bridge();
  if (api) return api.openExternal(url);
  window.open(url, '_blank', 'noopener,noreferrer');
  return { ok: true };
}

export async function openMapsFolder(): Promise<DesktopResult> {
  const api = bridge();
  if (!api) return { ok: false, error: 'Opening the workshop folder is available in the desktop build.' };
  return api.openMapsFolder();
}

export async function launchGame(): Promise<DesktopResult> {
  const api = bridge();
  if (api) return api.launchGame();
  window.open('steam://rungameid/252950');
  return { ok: true };
}

/**
 * Hand the selected car/boost/paint to VelocityRL by writing its swaps.json.
 * The VelocityRL proxy reads swaps.json fresh from disk on every request, so
 * this is what makes the selected car show up client-side in game.
 */
export async function applyVelocityLoadout(payload: {
  carName: string;
  boostName: string | null;
  paintId: number;
}): Promise<DesktopResult> {
  const items: VelocitySwapItem[] = [];
  if (payload.carName) {
    const productId = CAR_PRODUCT_IDS[payload.carName];
    if (productId) {
      items.push({ name: payload.carName, productId, slot: 'Body', paintId: payload.paintId });
    }
  }
  if (payload.boostName) {
    const productId = BOOST_PRODUCT_IDS[payload.boostName];
    if (productId) {
      items.push({ name: payload.boostName, productId, slot: 'Rocket Boost', paintId: 0 });
    }
  }
  if (!items.length) {
    return { ok: false, error: 'None of the selected items map to an in-game product. That item may not exist in the item database.' };
  }
  const api = bridge();
  if (!api) return { ok: false, error: 'Desktop bridge unavailable.' };
  return api.applyLoadoutToVelocity({ items });
}
