import { useMemo, useState } from 'react';
import type { HitboxId, Loadout, Team } from '../types';
import {
  BOOSTS,
  CARS,
  HITBOXES,
  HITBOX_BY_ID,
  PAINT_COLORS,
  PAINT_FINISHES,
  TEAM_DEFAULTS,
  getBoost,
  getCar,
} from '../data';
import { alpha } from '../lib/color';
import { CarPreview } from './CarPreview';
import { Icon } from './Icons';

interface GarageProps {
  loadout: Loadout;
  modEnabled: boolean;
  onToggleMod: () => void;
  onChange: (patch: Partial<Loadout>) => void;
  presetName: string;
  onPresetNameChange: (name: string) => void;
  onSave: () => void;
  onQuickSave: () => void;
  onExport: () => void;
  onNew: () => void;
  editing: boolean;
  dirty: boolean;
  hitboxFilter: HitboxId | 'all';
  onHitboxFilter: (id: HitboxId | 'all') => void;
  onOpenHitboxLab: () => void;
  velocityReady: boolean;
  onOpenVelocity: () => void;
  onOpenSetup: () => void;
}

type PaintTarget = 'primary' | 'secondary';

export function Garage({
  loadout,
  modEnabled,
  onToggleMod,
  onChange,
  presetName,
  onPresetNameChange,
  onSave,
  onQuickSave,
  onExport,
  onNew,
  editing,
  dirty,
  hitboxFilter,
  onHitboxFilter,
  onOpenHitboxLab,
  velocityReady,
  onOpenVelocity,
  onOpenSetup,
}: GarageProps) {
  const [carQuery, setCarQuery] = useState('');
  const [boostQuery, setBoostQuery] = useState('');
  const [paintTarget, setPaintTarget] = useState<PaintTarget>('primary');
  const [showHitbox, setShowHitbox] = useState(true);

  const car = getCar(loadout.carId) ?? CARS[0];
  const hitbox = HITBOX_BY_ID[car.hitbox];
  const boost = getBoost(loadout.boostId);
  const teamDefaults = TEAM_DEFAULTS[loadout.team];

  const primary = loadout.stockPaint ? teamDefaults.primary : loadout.primary;
  const secondary = loadout.stockPaint ? teamDefaults.secondary : loadout.secondary;
  const finishPrimary = loadout.stockPaint ? 'glossy' : loadout.finishPrimary;
  const finishSecondary = loadout.stockPaint ? 'glossy' : loadout.finishSecondary;

  const cars = useMemo(() => {
    const query = carQuery.trim().toLowerCase();
    return CARS.filter((entry) => {
      if (hitboxFilter !== 'all' && entry.hitbox !== hitboxFilter) return false;
      if (!query) return true;
      return entry.name.toLowerCase().includes(query) || HITBOX_BY_ID[entry.hitbox].name.toLowerCase().includes(query);
    });
  }, [carQuery, hitboxFilter]);

  const boosts = useMemo(() => {
    const query = boostQuery.trim().toLowerCase();
    if (!query) return BOOSTS;
    return BOOSTS.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [boostQuery]);

  const activeHex = paintTarget === 'primary' ? loadout.primary : loadout.secondary;
  const activeFinish = paintTarget === 'primary' ? loadout.finishPrimary : loadout.finishSecondary;
  const activeColorName = PAINT_COLORS.find((color) => color.hex.toUpperCase() === activeHex.toUpperCase())?.name;
  const activeFinishName = PAINT_FINISHES.find((finish) => finish.id === activeFinish)?.name ?? 'Glossy';

  const setPaintValue = (hex: string) => {
    if (paintTarget === 'primary') onChange({ primary: hex, stockPaint: false });
    else onChange({ secondary: hex, stockPaint: false });
  };

  const setFinish = (finishId: string) => {
    if (paintTarget === 'primary') onChange({ finishPrimary: finishId, stockPaint: false });
    else onChange({ finishSecondary: finishId, stockPaint: false });
  };

  const setTeam = (team: Team) => onChange({ team });

  return (
    <div className="garage">
      <aside className="preview-col">
        <section className="panel preview-panel">
          <div className="panel-head preview-head">
            <div>
              <div className="eyebrow">
                <b>01</b> Live preview
              </div>
              <div className="panel-title">{modEnabled ? 'Overlay stall' : 'Mod paused'}</div>
            </div>
            {modEnabled ? (
              <div className="preview-controls">
                <div className="seg" role="group" aria-label="Team">
                  <button
                    className={`blue ${loadout.team === 'blue' ? 'active' : ''}`}
                    onClick={() => setTeam('blue')}
                  >
                    Blue
                  </button>
                  <button
                    className={`orange ${loadout.team === 'orange' ? 'active' : ''}`}
                    onClick={() => setTeam('orange')}
                  >
                    Orange
                  </button>
                </div>
                <button
                  className={`switch ${showHitbox ? 'on' : ''}`}
                  role="switch"
                  aria-checked={showHitbox}
                  aria-label="Show hitbox overlay"
                  onClick={() => setShowHitbox((value) => !value)}
                />
              </div>
            ) : (
              <span className="off-badge">Paused</span>
            )}
          </div>

          {modEnabled ? (
            <>
              <div className={`stage ${loadout.team}`}>
                <div className="stage-meta">
                  <span className={`team-chip ${loadout.team}`}>{loadout.team} team</span>
                  <span className="stage-car-name">{car.name}</span>
                </div>
                <CarPreview
                  car={car}
                  hitbox={hitbox}
                  boost={boost}
                  primary={primary}
                  secondary={secondary}
                  finishPrimary={finishPrimary}
                  finishSecondary={finishSecondary}
                  showHitbox={showHitbox}
                />
                <div className="stage-foot">
                  <span>
                    <i className="dot" style={{ background: hitbox.color }} />
                    {hitbox.name} hitbox · client-side
                  </span>
                  <span>{showHitbox ? 'Stylised body · hitbox to scale' : 'Hitbox hidden'}</span>
                </div>
              </div>

              <div className="spec-grid">
                <div className="spec">
                  <span>Length</span>
                  <b>
                    {hitbox.length.toFixed(2)} <em>uu</em>
                  </b>
                </div>
                <div className="spec">
                  <span>Width</span>
                  <b>
                    {hitbox.width.toFixed(2)} <em>uu</em>
                  </b>
                </div>
                <div className="spec">
                  <span>Height</span>
                  <b>
                    {hitbox.height.toFixed(2)} <em>uu</em>
                  </b>
                </div>
                <div className="spec">
                  <span>Ground ht.</span>
                  <b>
                    {hitbox.groundHeight ? hitbox.groundHeight.toFixed(2) : '—'}{' '}
                    <em>{hitbox.groundHeight ? 'uu' : ''}</em>
                  </b>
                </div>
              </div>

              <button className="preview-lab-link" onClick={onOpenHitboxLab}>
                <span>
                  <Icon name="info" size={14} /> Compare all six hitboxes
                </span>
                <Icon name="arrow" size={14} />
              </button>
            </>
          ) : (
            <>
              <div className="stage-off">
                <span className="off-tag">Mod off</span>
                <div className="power-mark">
                  <Icon name="power" size={22} />
                </div>
                <h3>Nothing from your loadout is showing.</h3>
                <p>
                  The car, boost and paint are hidden together. Turn the master switch back on and the whole loadout
                  comes straight back.
                </p>
                <button className="btn primary" onClick={onToggleMod}>
                  <Icon name="power" size={13} /> Turn mod on
                </button>
              </div>
              <div className="off-strip">
                <span>Paused</span>
                <b>Your loadout is saved and still editable</b>
                <em>Nothing is applied while the switch is off.</em>
              </div>
            </>
          )}
        </section>

        <section className="panel save-card">
          <div className="save-card-head">
            <div>
              <div className="eyebrow">
                <b>02</b> Preset
              </div>
              <div className="panel-title">{editing ? 'Editing saved loadout' : 'Save this loadout'}</div>
            </div>
            {editing && (
              <span className={`saved-badge ${dirty ? 'unsaved' : ''}`}>{dirty ? 'Unsaved' : 'Saved'}</span>
            )}
          </div>
          <input
            className="input"
            value={presetName}
            maxLength={80}
            onChange={(event) => onPresetNameChange(event.target.value)}
            placeholder="Loadout name"
            aria-label="Preset name"
          />
          <div className="save-actions">
            <button className="btn primary" onClick={onSave}>
              <Icon name="save" size={14} /> Save
            </button>
            <button className="btn" onClick={onExport}>
              <Icon name="download" size={14} /> Export
            </button>
            {editing && (
              <button className="btn ghost" onClick={onNew}>
                New
              </button>
            )}
          </div>
          <p className="hint">
            Stored locally as a <code>.json</code> preset. Cosmetics stay on your screen only.
          </p>
        </section>

        <section className="panel apply-card">
          <div className="eyebrow">
            <b>↳</b> In game
          </div>
          <div className="panel-title">Show it in Rocket League</div>
          {velocityReady ? (
            <>
              <div className="save-actions">
                <button className="btn primary" onClick={onOpenVelocity}>
                  <Icon name="play" size={14} /> Open VelocityRL
                </button>
              </div>
              <p className="hint">
                Design the look here, then recreate it once as a <b>VelocityRL preset</b> — spawn the same body,
                boost and paint colours there and it applies in game client-side, with one-click restore.
              </p>
            </>
          ) : (
            <>
              <p className="hint">
                To see your loadout in game, HITBOX needs VelocityRL — the client-side item spawner. Setup
                installs it for you in one click.
              </p>
              <div className="save-actions">
                <button className="btn primary" onClick={onOpenSetup}>
                  <Icon name="download" size={14} /> Open setup
                </button>
              </div>
            </>
          )}
        </section>
      </aside>

      <section className="picker-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                <b>03</b> Car body
              </div>
              <div className="panel-title">
                {cars.length} <span className="title-muted">of {CARS.length} bodies</span>
              </div>
            </div>
            <span className="panel-note">All cars share the same stats · hitbox decides the collision box</span>
          </div>

          <div className="picker-tools">
            <div className="search">
              <Icon name="search" size={15} className="search-icon" />
              <input
                className="input"
                value={carQuery}
                onChange={(event) => setCarQuery(event.target.value)}
                placeholder="Search cars, hitboxes…"
                aria-label="Search cars"
              />
            </div>
            <div className="filters" role="group" aria-label="Filter by hitbox">
              <button
                className={`chip ${hitboxFilter === 'all' ? 'active' : ''}`}
                onClick={() => onHitboxFilter('all')}
              >
                All <span className="chip-count">{CARS.length}</span>
              </button>
              {HITBOXES.map((entry) => (
                <button
                  key={entry.id}
                  className={`chip ${hitboxFilter === entry.id ? 'active' : ''}`}
                  onClick={() => onHitboxFilter(entry.id)}
                >
                  <i className="dot" style={{ background: entry.color }} />
                  {entry.name}
                </button>
              ))}
            </div>
            <button
              className={`btn small quick-save ${dirty ? 'primary' : ''}`}
              onClick={onQuickSave}
              disabled={!dirty}
              title={
                dirty
                  ? editing
                    ? 'Save changes to this preset'
                    : 'Save this loadout to your library'
                  : 'All changes saved'
              }
            >
              <Icon name={dirty ? 'save' : 'check'} size={12} />
              {dirty ? (editing ? 'Save changes' : 'Save loadout') : 'Saved'}
            </button>
          </div>

          <div className="car-grid">
            {cars.map((entry) => {
              const entryHitbox = HITBOX_BY_ID[entry.hitbox];
              return (
                <button
                  key={entry.id}
                  className={`car-card ${entry.id === car.id ? 'selected' : ''}`}
                  onClick={() => onChange({ carId: entry.id })}
                  aria-pressed={entry.id === car.id}
                  title={`${entry.name} — ${entryHitbox.name} hitbox`}
                >
                  {entry.id === car.id && (
                    <span className="car-picked" aria-hidden="true">
                      <Icon name="check" size={9} />
                    </span>
                  )}
                  <span className="car-name">{entry.name}</span>
                  <span className="car-hitbox" style={{ color: entryHitbox.color }}>
                    <i className="dot" style={{ background: entryHitbox.color }} />
                    {entryHitbox.name}
                  </span>
                </button>
              );
            })}
            {cars.length === 0 && <div className="empty-inline">No car matches that search.</div>}
          </div>
        </section>

        <div className="pick-row">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  <b>04</b> Rocket boost
                </div>
                <div className="panel-title">{boost ? boost.name : 'Stock boost'}</div>
              </div>
              <span className="panel-note">{BOOSTS.length} in catalog</span>
            </div>
            <div className="picker-tools compact">
              <div className="search">
                <Icon name="search" size={15} className="search-icon" />
                <input
                  className="input"
                  value={boostQuery}
                  onChange={(event) => setBoostQuery(event.target.value)}
                  placeholder="Search boosts…"
                  aria-label="Search boosts"
                />
              </div>
            </div>
            <div className="boost-list">
              <button
                className={`boost-item ${loadout.boostId === null ? 'selected' : ''}`}
                onClick={() => onChange({ boostId: null })}
              >
                <span className="flame-dot" style={{ color: '#7D8C9C' }} />
                Stock boost <span className="as-is">as is</span>
              </button>
              {boosts.map((entry) => (
                <button
                  key={entry.id}
                  className={`boost-item ${loadout.boostId === entry.id ? 'selected' : ''}`}
                  onClick={() => onChange({ boostId: entry.id })}
                  title={entry.name}
                >
                  <span className="flame-dot" style={{ color: entry.tone }} />
                  {entry.name}
                </button>
              ))}
              {boosts.length === 0 && <div className="empty-inline">No boost matches that search.</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  <b>05</b> Paint
                </div>
                <div className="panel-title">{loadout.stockPaint ? 'Factory paint' : `${activeColorName ?? activeHex}`}</div>
              </div>
              <button
                className={`switch ${loadout.stockPaint ? 'on' : ''}`}
                role="switch"
                aria-checked={loadout.stockPaint}
                aria-label="Use factory paint"
                onClick={() => onChange({ stockPaint: !loadout.stockPaint })}
              />
            </div>

            <div className="paint-body">
              <div className={`stock-banner ${loadout.stockPaint ? 'on' : ''}`}>
                <div>
                  <b>Keep it as is</b>
                  <span>Factory team colours, no paint override.</span>
                </div>
                <span className="stock-chip">{loadout.stockPaint ? 'On' : 'Off'}</span>
              </div>

              <div className={`paint-controls ${loadout.stockPaint ? 'disabled' : ''}`}>
                <div className="paint-tabs">
                  <button
                    className={`paint-tab ${paintTarget === 'primary' ? 'active' : ''}`}
                    onClick={() => setPaintTarget('primary')}
                  >
                    <span className="swatch-big" style={{ background: primary }} />
                    Primary
                  </button>
                  <button
                    className={`paint-tab ${paintTarget === 'secondary' ? 'active' : ''}`}
                    onClick={() => setPaintTarget('secondary')}
                  >
                    <span className="swatch-big" style={{ background: secondary }} />
                    Secondary
                  </button>
                </div>

                <div className="swatch-grid">
                  {PAINT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      className={`swatch ${
                        activeHex.toUpperCase() === color.hex.toUpperCase() && !loadout.stockPaint ? 'active' : ''
                      }`}
                      style={{ background: color.hex, boxShadow: `inset 0 0 0 1px ${alpha(color.hex, 0.35)}` }}
                      title={color.name}
                      aria-label={color.name}
                      onClick={() => setPaintValue(color.hex)}
                    />
                  ))}
                </div>

                <div className="paint-row">
                  <label className="color-pick">
                    <input
                      type="color"
                      className="color-input"
                      value={activeHex}
                      onChange={(event) => setPaintValue(event.target.value.toUpperCase())}
                      aria-label="Pick any paint colour"
                    />
                    <span>
                      <b>Any colour</b>
                      <em>{activeHex}</em>
                    </span>
                  </label>
                  <select
                    className="input select"
                    value={activeFinish}
                    onChange={(event) => setFinish(event.target.value)}
                    aria-label="Paint finish"
                  >
                    {PAINT_FINISHES.map((finish) => (
                      <option key={finish.id} value={finish.id}>
                        {finish.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="hint">
                  {paintTarget === 'primary' ? 'Primary' : 'Secondary'} finish: {activeFinishName}. Picking a colour turns
                  off factory paint.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
