import type { Preset } from '../types';
import { FINISH_BY_ID, HITBOX_BY_ID, TEAM_DEFAULTS, getBoost, getCar } from '../data';
import { Icon } from './Icons';

interface LibraryProps {
  presets: Preset[];
  onLoad: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
  onExport: (preset: Preset) => void;
  onImport: () => void;
  onGoToGarage: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Library({ presets, onLoad, onDelete, onExport, onImport, onGoToGarage }: LibraryProps) {
  return (
    <div className="library">
      <section className="panel library-head">
        <div>
          <div className="eyebrow">
            <b>08</b> Loadout library
          </div>
          <h2>Your saved presets.</h2>
          <p>
            Loadouts live on this machine only. Load one back into the garage, export it as a file, or import a preset
            someone sent you.
          </p>
        </div>
        <div className="library-actions">
          <button className="btn" onClick={onImport}>
            <Icon name="upload" size={14} /> Import
          </button>
          <button className="btn primary" onClick={onGoToGarage}>
            <Icon name="car" size={14} /> Build a loadout
          </button>
        </div>
      </section>

      {presets.length === 0 ? (
        <div className="panel empty-state library-empty">
          <Icon name="save" size={28} />
          <h3>No saved loadouts yet</h3>
          <p>Pick a car, boost and paint in the garage, then hit Save.</p>
          <button className="btn" onClick={onGoToGarage}>
            Open garage
          </button>
        </div>
      ) : (
        <div className="preset-grid">
          {presets.map((preset) => {
            const car = getCar(preset.loadout.carId);
            const hitbox = HITBOX_BY_ID[car?.hitbox ?? 'octane'];
            const boost = getBoost(preset.loadout.boostId ?? null);
            const defaults = TEAM_DEFAULTS[preset.loadout.team];
            const primary = preset.loadout.stockPaint ? defaults.primary : preset.loadout.primary;
            const secondary = preset.loadout.stockPaint ? defaults.secondary : preset.loadout.secondary;

            return (
              <article className="panel preset-card" key={preset.id}>
                <div className="preset-swatches">
                  <span style={{ background: primary }} />
                  <span style={{ background: secondary }} />
                </div>
                <div className="preset-head">
                  <div>
                    <h3>{preset.name}</h3>
                    <span className="preset-date">{formatDate(preset.updatedAt)}</span>
                  </div>
                  <span className={`team-chip ${preset.loadout.team}`}>{preset.loadout.team}</span>
                </div>
                <div className="preset-rows">
                  <div>
                    <span>Car</span>
                    <b>{car?.name ?? 'Unknown car'}</b>
                  </div>
                  <div>
                    <span>Hitbox</span>
                    <b style={{ color: hitbox.color }}>{hitbox.name}</b>
                  </div>
                  <div>
                    <span>Boost</span>
                    <b>{boost?.name ?? 'Stock boost'}</b>
                  </div>
                  <div>
                    <span>Paint</span>
                    <b>
                      {preset.loadout.stockPaint
                        ? 'Factory'
                        : FINISH_BY_ID[preset.loadout.finishPrimary]?.name ?? preset.loadout.finishPrimary}
                    </b>
                  </div>
                </div>
                <div className="preset-actions">
                  <button className="btn small primary" onClick={() => onLoad(preset)}>
                    <Icon name="play" size={12} /> Load
                  </button>
                  <button className="btn small" onClick={() => onExport(preset)}>
                    <Icon name="download" size={12} /> Export
                  </button>
                  <button className="btn small ghost danger" onClick={() => onDelete(preset)}>
                    <Icon name="trash" size={12} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="library-info">
        <section className="panel info-card">
          <div className="eyebrow">How it fits together</div>
          <h3>Preset file, not a game injector.</h3>
          <p>
            Hitbox is a loadout studio and map browser. It writes a clean <code>.rlpreset.json</code> file describing the
            car body, boost and paint you chose, plus the master <code>enabled</code> switch. Turning that preset into
            something you see in-game is the job of a client-side cosmetic mod; this app does not inject into Rocket
            League, unlock items, or change hitboxes.
          </p>
          <pre>{`{
  "name": "Fennec · Blue",
  "enabled": true,
  "loadout": {
    "team": "blue",
    "carId": "fennec",
    "boostId": "gold-rush",
    "primary": "#3F9BFF",
    "secondary": "#F2F5F7",
    "finishPrimary": "metallic"
  }
}`}</pre>
          <p className="info-foot">
            Cosmetics changed on the client stay on your screen. Other players never see them, and nothing here gives a
            gameplay advantage.
          </p>
        </section>

        <section className="panel info-card">
          <div className="eyebrow">Data notes</div>
          <h3>Where the numbers come from.</h3>
          <ul className="data-list">
            <li>
              <b>Car → hitbox</b> mapping follows Epic's official Rocket League hitbox support page.
            </li>
            <li>
              <b>Dimensions</b> are the widely cited community measurements in Unreal Units; Merc ground height is
              not published, so it shows a dash.
            </li>
            <li>
              <b>Hitboxes are collision only.</b> Every car shares the same movement stats.
            </li>
            <li>
              <b>Workshop IDs</b> point to real Steam pages; map size is read from the listing.
            </li>
            <li>
              <b>Presets</b> are local files, stored in your user data folder and never uploaded.
            </li>
          </ul>
          <p className="info-foot">
            Hitbox is an unofficial fan tool. Not affiliated with Psyonix, Epic Games, or Steam.
          </p>
        </section>
      </div>
    </div>
  );
}
