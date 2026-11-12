export type HitboxId = 'octane' | 'dominus' | 'breakout' | 'plank' | 'hybrid' | 'merc';

export type Team = 'blue' | 'orange';

export interface Hitbox {
  id: HitboxId;
  name: string;
  length: number;
  width: number;
  height: number;
  groundHeight: number | null;
  blurb: string;
  color: string;
}

export interface Car {
  id: string;
  name: string;
  hitbox: HitboxId;
  /** Game product id, used by the in-game bridge. 0 = not mapped yet. */
  productId?: number;
}

export interface Boost {
  id: string;
  name: string;
  tone: string;
  /** Game product id, used by the in-game bridge. 0 = not mapped yet. */
  productId?: number;
}

export interface PaintFinish {
  id: string;
  name: string;
}

export interface PaintColor {
  name: string;
  hex: string;
}

export interface Loadout {
  team: Team;
  carId: string;
  boostId: string | null;
  primary: string;
  secondary: string;
  finishPrimary: string;
  finishSecondary: string;
  stockPaint: boolean;
}

export interface Preset {
  id: string;
  name: string;
  updatedAt: string;
  loadout: Loadout;
  /** Master visibility switch at export time. */
  enabled?: boolean;
}

export type MapCategory =
  | 'Dribbling'
  | 'Rings'
  | 'Parkour'
  | 'Training'
  | 'Race'
  | 'Mini-game'
  | 'Remake';

export type MapDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Extreme';

export interface WorkshopMap {
  id: string;
  name: string;
  author: string;
  category: MapCategory;
  difficulty: MapDifficulty;
  players: string;
  sizeMB: number;
  description: string;
  featured?: boolean;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'current'
  | 'error'
  | 'unsupported';

export interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  percent: number | null;
  error: string | null;
}

export interface UpdateResult {
  ok: boolean;
  status?: string;
  version?: string | null;
  error?: string;
}

export interface WorkshopMapDetails {
  id: string;
  name: string;
  author: string;
  sizeMB: number;
  description: string;
  previewUrl?: string;
  subscriptions?: number;
}

export interface DesktopResult<T = undefined> {
  ok: boolean;
  error?: string;
  note?: string;
  canceled?: boolean;
  path?: string;
  map?: WorkshopMapDetails;
  method?: 'epic' | 'steam' | 'executable';
  preset?: Preset;
  presets?: Preset[];
  value?: T;
}

export interface SetupStatus {
  rocketLeague: string | null;
  bakkesMod: boolean;
  bridgePlugin: boolean;
  bridgeFolder?: string;
  bridgeStatus?: Record<string, string>;
}

export interface LiveApplyRequest {
  enabled: boolean;
  bodyProductId: number;
  boostProductId: number;
  primary: string | null;
  secondary: string | null;
  asIs: boolean;
}

export interface DesktopApi {
  version: () => Promise<string>;
  platform: () => Promise<string>;
  listPresets: () => Promise<DesktopResult>;
  savePreset: (preset: Omit<Preset, 'updatedAt'> & { updatedAt?: string }) => Promise<DesktopResult>;
  deletePreset: (id: string) => Promise<DesktopResult>;
  exportPreset: (preset: Preset) => Promise<DesktopResult>;
  importPreset: () => Promise<DesktopResult>;
  openMapsFolder: () => Promise<DesktopResult>;
  openExternal: (url: string) => Promise<DesktopResult>;
  launchGame: () => Promise<DesktopResult>;
  setupStatus: () => Promise<SetupStatus>;
  installBakkesMod: () => Promise<DesktopResult>;
  installBridgePlugin: () => Promise<DesktopResult>;
  applyToGame: (live: LiveApplyRequest) => Promise<DesktopResult>;
  readLoadoutDump: () => Promise<DesktopResult>;
  openBridgeFolder: () => Promise<DesktopResult>;
  lookupWorkshopMap: (id: string) => Promise<DesktopResult>;
  checkForUpdates: () => Promise<UpdateResult>;
  installUpdate: () => Promise<DesktopResult>;
  getUpdateState: () => Promise<UpdateState>;
  onUpdateState: (callback: (state: UpdateState) => void) => void;
}

declare global {
  interface Window {
    hitboxDesktop?: DesktopApi;
  }
}
