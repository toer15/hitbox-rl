import type { Boost, Car, Hitbox } from '../types';
import { alpha, darken, lighten, mix } from '../lib/color';

interface CarPreviewProps {
  car: Car;
  hitbox: Hitbox;
  boost?: Boost;
  primary: string;
  secondary: string;
  finishPrimary: string;
  finishSecondary: string;
  showHitbox: boolean;
}

const CX = 320;
const CY = 214;

interface Stop {
  offset: string;
  color: string;
}

function stopsFor(hex: string, finish: string, other: string): Stop[] {
  if (
    finish.startsWith('matte') ||
    finish === 'sun-damaged' ||
    finish === 'moon-rock' ||
    finish === 'knitted-yarn' ||
    finish === 'cookie-dough'
  ) {
    return [
      { offset: '0%', color: lighten(hex, 0.1) },
      { offset: '100%', color: darken(hex, 0.12) },
    ];
  }

  if (finish.startsWith('metallic') || finish === 'brushed-metal' || finish === 'corroded-metal') {
    return [
      { offset: '0%', color: lighten(hex, 0.55) },
      { offset: '24%', color: darken(hex, 0.22) },
      { offset: '48%', color: lighten(hex, 0.32) },
      { offset: '74%', color: darken(hex, 0.3) },
      { offset: '100%', color: lighten(hex, 0.12) },
    ];
  }

  if (finish.startsWith('pearlescent') || finish === 'anodized-pearl') {
    return [
      { offset: '0%', color: lighten(hex, 0.4) },
      { offset: '50%', color: mix(hex, other, 0.55) },
      { offset: '100%', color: darken(hex, 0.32) },
    ];
  }

  if (finish === 'anodized') {
    return [
      { offset: '0%', color: darken(hex, 0.52) },
      { offset: '50%', color: hex },
      { offset: '100%', color: lighten(hex, 0.22) },
    ];
  }

  if (finish.startsWith('toon')) {
    return [
      { offset: '0%', color: hex },
      { offset: '100%', color: darken(hex, 0.2) },
    ];
  }

  return [
    { offset: '0%', color: lighten(hex, 0.38) },
    { offset: '30%', color: lighten(hex, 0.12) },
    { offset: '62%', color: hex },
    { offset: '100%', color: darken(hex, 0.42) },
  ];
}

export function CarPreview({
  car,
  hitbox,
  boost,
  primary,
  secondary,
  finishPrimary,
  finishSecondary,
  showHitbox,
}: CarPreviewProps) {
  const scale = 3.1;
  const halfL = (hitbox.length * scale) / 2;
  const halfW = (hitbox.width * scale) / 2;
  const bodyL = halfL * 0.9;
  const bodyW = halfW * 0.78;

  const bodyPath = [
    `M ${-bodyL * 0.98} ${-bodyW * 0.6}`,
    `L ${-bodyL * 0.55} ${-bodyW * 0.92}`,
    `L ${bodyL * 0.55} ${-bodyW * 0.86}`,
    `Q ${bodyL * 1.02} ${-bodyW * 0.55} ${bodyL * 1.04} 0`,
    `Q ${bodyL * 1.02} ${bodyW * 0.55} ${bodyL * 0.55} ${bodyW * 0.86}`,
    `L ${-bodyL * 0.55} ${bodyW * 0.92}`,
    `L ${-bodyL * 0.98} ${bodyW * 0.6}`,
    `Q ${-bodyL * 1.06} 0 ${-bodyL * 0.98} ${-bodyW * 0.6}`,
    'Z',
  ].join(' ');

  const cabinPath = [
    `M ${-bodyL * 0.27} ${-bodyW * 0.52}`,
    `L ${bodyL * 0.14} ${-bodyW * 0.4}`,
    `L ${bodyL * 0.31} 0`,
    `L ${bodyL * 0.14} ${bodyW * 0.4}`,
    `L ${-bodyL * 0.27} ${bodyW * 0.52}`,
    `L ${-bodyL * 0.4} 0`,
    'Z',
  ].join(' ');

  const primaryStops = stopsFor(primary, finishPrimary, secondary);
  const secondaryStops = stopsFor(secondary, finishSecondary, primary);

  const wheels = [
    { x: bodyL * 0.58, y: bodyW * 0.9 },
    { x: bodyL * 0.58, y: -bodyW * 0.9 },
    { x: -bodyL * 0.58, y: bodyW * 0.9 },
    { x: -bodyL * 0.58, y: -bodyW * 0.9 },
  ];

  return (
    <svg
      viewBox="0 0 640 428"
      className="car-preview-svg"
      role="img"
      aria-label={`${car.name} top-down preview on the ${hitbox.name} hitbox`}
    >
      <defs>
        <pattern id="previewGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#7E97AD" strokeOpacity="0.075" strokeWidth="1" />
        </pattern>
        <radialGradient id="stageGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={alpha(hitbox.color, 0.14)} />
          <stop offset="100%" stopColor={alpha(hitbox.color, 0)} />
        </radialGradient>
        <linearGradient id="primaryPaint" x1="0" y1="0" x2="0.12" y2="1">
          {primaryStops.map((stop) => (
            <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
        <linearGradient id="secondaryPaint" x1="0" y1="0" x2="0.12" y2="1">
          {secondaryStops.map((stop) => (
            <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
        <linearGradient id="flameGradient" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor={boost?.tone ?? '#7CC8FF'} stopOpacity="0.95" />
          <stop offset="55%" stopColor={boost?.tone ?? '#7CC8FF'} stopOpacity="0.55" />
          <stop offset="100%" stopColor={boost?.tone ?? '#7CC8FF'} stopOpacity="0" />
        </linearGradient>
        <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <rect width="640" height="428" fill="url(#previewGrid)" />
      <ellipse cx={CX} cy={CY} rx="264" ry="158" fill="url(#stageGlow)" />

      <g transform={`translate(${CX} ${CY})`}>
        {showHitbox && (
          <g>
            <rect
              x={-halfL}
              y={-halfW}
              width={halfL * 2}
              height={halfW * 2}
              rx={6}
              fill={alpha(hitbox.color, 0.055)}
              stroke={hitbox.color}
              strokeOpacity="0.9"
              strokeWidth="1.5"
              strokeDasharray="8 6"
            />
            {[
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].map(([sx, sy]) => (
              <path
                key={`${sx}-${sy}`}
                d={`M ${sx * halfL - sx * 24} ${sy * halfW} L ${sx * halfL} ${sy * halfW} L ${sx * halfL} ${
                  sy * halfW - sy * 24
                }`}
                fill="none"
                stroke={hitbox.color}
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
            <text
              x={-halfL + 10}
              y={-halfW + 17}
              fill={hitbox.color}
              fillOpacity="0.85"
              fontFamily="Consolas, monospace"
              fontSize="8"
              letterSpacing="2"
            >
              HITBOX
            </text>

            <g opacity="0.9">
              <path
                d={`M ${-halfL} ${-halfW - 26} L ${halfL} ${-halfW - 26}`}
                stroke={hitbox.color}
                strokeWidth="1"
                strokeOpacity="0.5"
              />
              <path
                d={`M ${-halfL} ${-halfW - 32} L ${-halfL} ${-halfW - 20} M ${halfL} ${-halfW - 32} L ${halfL} ${
                  -halfW - 20
                }`}
                stroke={hitbox.color}
                strokeWidth="1.5"
              />
              <rect
                x={-48}
                y={-halfW - 36}
                width={96}
                height={19}
                rx={4}
                fill="#080D12"
                stroke={hitbox.color}
                strokeOpacity="0.65"
              />
              <text
                x={0}
                y={-halfW - 23}
                textAnchor="middle"
                fill="#E8F2FC"
                fontFamily="Consolas, monospace"
                fontSize="10"
              >
                {hitbox.length.toFixed(2)} uu
              </text>
            </g>

            <g transform={`translate(${-halfL - 30} 0) rotate(-90)`} opacity="0.9">
              <rect x={-46} y={-9.5} width={92} height={19} rx={4} fill="#080D12" stroke={hitbox.color} strokeOpacity="0.65" />
              <text
                x={0}
                y={3.5}
                textAnchor="middle"
                fill="#E8F2FC"
                fontFamily="Consolas, monospace"
                fontSize="10"
              >
                {hitbox.width.toFixed(2)} uu
              </text>
            </g>
          </g>
        )}

        {boost && (
          <g transform={`translate(${-bodyL * 0.99} 0)`}>
            <ellipse
              cx={-26}
              cy={0}
              rx={52}
              ry={22}
              fill={alpha(boost.tone, 0.22)}
              filter="url(#softGlow)"
              className="boost-glow"
            />
            <path
              d="M 2 -8 C -18 -16 -46 -10 -76 0 C -46 10 -18 16 2 8 Z"
              fill="url(#flameGradient)"
              className="boost-flame"
            />
            <circle cx={2} cy={0} r={6} fill={lighten(boost.tone, 0.35)} />
          </g>
        )}

        <g filter="url(#carShadow)">
          {wheels.map((wheel, index) => (
            <g key={index}>
              <rect
                x={wheel.x - bodyL * 0.13}
                y={wheel.y - bodyW * 0.09}
                width={bodyL * 0.26}
                height={bodyW * 0.18}
                rx={4}
                fill="#0A0F14"
                stroke="#293645"
                strokeWidth="1"
              />
              <rect
                x={wheel.x - bodyL * 0.045}
                y={wheel.y - bodyW * 0.045}
                width={bodyL * 0.09}
                height={bodyW * 0.09}
                rx={2}
                fill={mix(secondary, '#ffffff', 0.2)}
                opacity="0.6"
              />
            </g>
          ))}

          <rect
            x={-bodyL * 1.03}
            y={-bodyW * 0.72}
            width={bodyL * 0.14}
            height={bodyW * 1.44}
            rx={3}
            fill="url(#secondaryPaint)"
            stroke={alpha(secondary, 0.85)}
            strokeWidth="1"
          />

          <path d={bodyPath} fill="url(#primaryPaint)" stroke={alpha(primary, 0.95)} strokeWidth="1.4" />

          <path
            d={`M ${-bodyL * 0.86} ${-bodyW * 0.62} L ${bodyL * 0.48} ${-bodyW * 0.7}`}
            stroke={secondary}
            strokeWidth="3.5"
            strokeOpacity="0.45"
            strokeLinecap="round"
          />
          <path
            d={`M ${-bodyL * 0.86} ${bodyW * 0.62} L ${bodyL * 0.48} ${bodyW * 0.7}`}
            stroke={secondary}
            strokeWidth="3.5"
            strokeOpacity="0.45"
            strokeLinecap="round"
          />

          <path
            d={cabinPath}
            fill="url(#secondaryPaint)"
            stroke="#05080B"
            strokeOpacity="0.65"
            strokeWidth="1.2"
          />
          <path
            d={`M ${bodyL * 0.12} ${-bodyW * 0.38} L ${bodyL * 0.29} 0 L ${bodyL * 0.12} ${bodyW * 0.38} L ${
              bodyL * 0.01
            } ${bodyW * 0.32} L ${bodyL * 0.13} 0 L ${bodyL * 0.01} ${-bodyW * 0.32} Z`}
            fill="#BFE0FA"
            fillOpacity="0.18"
          />
          <path
            d={`M ${-bodyL * 0.24} ${-bodyW * 0.36} L ${bodyL * 0.04} ${-bodyW * 0.3} L ${bodyL * 0.04} ${
              bodyW * 0.3
            } L ${-bodyL * 0.24} ${bodyW * 0.36} Z`}
            fill="#04080C"
            fillOpacity="0.32"
          />

          <path
            d={`M ${bodyL * 0.72} ${-bodyW * 0.4} L ${bodyL * 0.9} ${-bodyW * 0.24} L ${bodyL * 0.9} ${
              -bodyW * 0.12
            } L ${bodyL * 0.72} ${-bodyW * 0.26} Z`}
            fill="#FFF3C4"
            fillOpacity="0.9"
          />
          <path
            d={`M ${bodyL * 0.72} ${bodyW * 0.4} L ${bodyL * 0.9} ${bodyW * 0.24} L ${bodyL * 0.9} ${
              bodyW * 0.12
            } L ${bodyL * 0.72} ${bodyW * 0.26} Z`}
            fill="#FFF3C4"
            fillOpacity="0.9"
          />
          <rect
            x={-bodyL * 0.99}
            y={-bodyW * 0.43}
            width={bodyL * 0.06}
            height={bodyW * 0.22}
            rx={2}
            fill="#FF4D5E"
            fillOpacity="0.9"
          />
          <rect
            x={-bodyL * 0.99}
            y={bodyW * 0.21}
            width={bodyL * 0.06}
            height={bodyW * 0.22}
            rx={2}
            fill="#FF4D5E"
            fillOpacity="0.9"
          />
        </g>
      </g>
    </svg>
  );
}
