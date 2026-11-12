import type { HitboxId } from '../types';
import { CARS, CARS_BY_HITBOX, HITBOXES } from '../data';
import { alpha } from '../lib/color';
import { Icon } from './Icons';

interface HitboxLabProps {
  onBrowse: (hitbox: HitboxId) => void;
}

const CHART_SCALE = 2.15;
const CX = 330;
const CY = 176;

export function HitboxLab({ onBrowse }: HitboxLabProps) {
  return (
    <div className="lab">
      <section className="panel lab-intro">
        <div>
          <div className="eyebrow">
            <b>06</b> Hitbox lab
          </div>
          <h2>Six collision boxes. Every body maps to one.</h2>
          <p>
            Rocket League gives every car the same speed, acceleration and handling. What changes is the collision box.
            These are the six body types, drawn at the same scale with the community-measured dimensions in Unreal
            Units (1 uu = 0.75 in).
          </p>
        </div>
        <div className="lab-summary">
          <div>
            <span>Bodies catalogued</span>
            <b>{CARS.length}</b>
          </div>
          <div>
            <span>Body types</span>
            <b>6</b>
          </div>
          <div>
            <span>Longest</span>
            <b>Breakout</b>
          </div>
          <div>
            <span>Tallest</span>
            <b>Merc</b>
          </div>
        </div>
      </section>

      <section className="panel compare-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Overlay</div>
            <div className="panel-title">All six, to scale</div>
          </div>
          <span className="panel-note">Top-down · length × width</span>
        </div>
        <div className="compare-body">
          <svg viewBox="0 0 660 352" className="compare-svg" role="img" aria-label="All six hitboxes to scale">
            <defs>
              <pattern id="labGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7E97AD" strokeOpacity="0.08" />
              </pattern>
            </defs>
            <rect width="660" height="352" fill="url(#labGrid)" />
            <g transform={`translate(${CX} ${CY})`}>
              <path d="M -240 0 H 240 M 0 -150 V 150" stroke="#22303E" strokeDasharray="3 5" />
              {HITBOXES.map((hitbox) => {
                const halfL = (hitbox.length * CHART_SCALE) / 2;
                const halfW = (hitbox.width * CHART_SCALE) / 2;
                return (
                  <g key={hitbox.id}>
                    <rect
                      x={-halfL}
                      y={-halfW}
                      width={halfL * 2}
                      height={halfW * 2}
                      rx={4}
                      fill={alpha(hitbox.color, 0.055)}
                      stroke={hitbox.color}
                      strokeWidth="1.6"
                      strokeOpacity="0.9"
                    />
                    <text
                      x={-halfL + 6}
                      y={-halfW - 6}
                      fill={hitbox.color}
                      fontFamily="Consolas, monospace"
                      fontSize="9"
                      letterSpacing="1.5"
                    >
                      {hitbox.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
            <g transform="translate(40 322)">
              <path d={`M 0 0 H ${100 * (CHART_SCALE / 2)}`} stroke="#6C8196" strokeWidth="1.5" />
              <path d="M 0 -4 V 4 M 107.5 -4 V 4" stroke="#6C8196" strokeWidth="1.5" />
              <text x="0" y="-9" fill="#6C8196" fontFamily="Consolas, monospace" fontSize="9">
                100 uu
              </text>
            </g>
          </svg>

          <div className="compare-legend">
            {HITBOXES.map((hitbox) => (
              <button key={hitbox.id} className="legend-row" onClick={() => onBrowse(hitbox.id)}>
                <i className="dot" style={{ background: hitbox.color }} />
                <span className="legend-name">{hitbox.name}</span>
                <span className="legend-count">{CARS_BY_HITBOX[hitbox.id].length}</span>
                <span className="legend-dim">
                  {hitbox.length.toFixed(1)} × {hitbox.width.toFixed(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="lab-cards">
        {HITBOXES.map((hitbox) => {
          const cars = CARS_BY_HITBOX[hitbox.id];
          return (
            <article className="panel hitbox-card" key={hitbox.id}>
              <div className="hitbox-bar" style={{ background: hitbox.color }} />
              <div className="hitbox-card-head">
                <h3 style={{ color: hitbox.color }}>{hitbox.name}</h3>
                <span className="hitbox-count">{cars.length} bodies</span>
              </div>
              <p className="hitbox-blurb">{hitbox.blurb}</p>
              <div className="hitbox-dims">
                <div>
                  <span>Length</span>
                  <b>{hitbox.length.toFixed(2)}</b>
                </div>
                <div>
                  <span>Width</span>
                  <b>{hitbox.width.toFixed(2)}</b>
                </div>
                <div>
                  <span>Height</span>
                  <b>{hitbox.height.toFixed(2)}</b>
                </div>
                <div>
                  <span>Ground ht.</span>
                  <b>{hitbox.groundHeight ? hitbox.groundHeight.toFixed(2) : '—'}</b>
                </div>
              </div>
              <div className="hitbox-examples">
                {cars.slice(0, 4).map((car) => car.name).join(' · ')}
                {cars.length > 4 ? ` · +${cars.length - 4} more` : ''}
              </div>
              <button className="btn small" onClick={() => onBrowse(hitbox.id)}>
                Browse {cars.length} cars <Icon name="arrow" size={13} />
              </button>
            </article>
          );
        })}
      </div>

      <p className="data-note">
        Measurements are the widely used community figures for each preset; Psyonix does not publish per-box numbers in
        game. Car-to-hitbox mapping follows Epic's official hitbox list. Hitbox data is reference only — Hitbox does not
        change collision boxes.
      </p>
    </div>
  );
}
