/*
 * Flat, low-poly style illustrations for the scenario quiz (inline SVG: offline, crisp,
 * no text inside so they work in every language).
 */

const RED = '#d62828';
const ORANGE = '#ff7a1a';
const YELLOW = '#ffd23f';
const SMOKE = '#8a929b';
const SKIN = '#c98b5f';
const VEST = '#ff7a1a';
const DARK = '#1d2530';
const GREEN = '#22c55e';

export function Flames({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <polygon points="-34,0 -14,-62 0,-20" fill={RED} />
      <polygon points="-10,0 12,-80 30,0" fill={ORANGE} />
      <polygon points="14,0 34,-50 44,0" fill={RED} />
      <polygon points="-8,0 10,-44 22,0" fill={YELLOW} />
      <polygon points="-24,0 -12,-30 -2,0" fill={YELLOW} />
    </g>
  );
}

export function Person({ x, y, crouch = false }: { x: number; y: number; crouch?: boolean }) {
  return crouch ? (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="10" cy="-46" r="9" fill={SKIN} />
      <polygon points="-2,-36 22,-38 26,-12 0,-10" fill={VEST} />
      <polygon points="0,-12 12,-12 18,0 4,0" fill={DARK} />
      <polygon points="14,-14 26,-12 30,0 20,0" fill={DARK} />
      <polygon points="22,-34 40,-24 36,-20 20,-28" fill={VEST} />
    </g>
  ) : (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-78" r="9" fill={SKIN} />
      <polygon points="-11,-68 11,-68 13,-34 -13,-34" fill={VEST} />
      <polygon points="-11,-34 -1,-34 -3,0 -12,0" fill={DARK} />
      <polygon points="1,-34 11,-34 12,0 3,0" fill={DARK} />
    </g>
  );
}

export function Extinguisher({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-10" y="-56" width="20" height="56" rx="8" fill={RED} />
      <rect x="-10" y="-40" width="20" height="9" fill="#1d1f22" />
      <rect x="-6" y="-64" width="12" height="8" fill="#2b2f35" />
      <path d="M4 -60 C24 -60 30 -50 34 -42" stroke="#1d1f22" strokeWidth="4" fill="none" />
      <circle cx="-9" cy="-62" r="4" fill="none" stroke="#cfd4da" strokeWidth="2" />
    </g>
  );
}

export function PassIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill="#2a3240" />
      <Extinguisher x={70} y={130} />
      <path
        d="M108 88 L210 112"
        stroke="#eef5ff"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Flames x={240} y={132} scale={0.9} />
      {['P', 'A', 'S', 'S'].map((letter, index) => (
        <g key={index} transform={`translate(${118 + index * 34} 36)`}>
          <circle r="14" fill={index === 0 ? GREEN : '#3b4656'} />
          <text
            y="5"
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill="#fff"
            fontFamily="Noto Sans, sans-serif"
          >
            {letter}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function AimIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill="#2a3240" />
      <rect x="150" y="118" width="130" height="14" fill="#6b5a4a" />
      <Flames x={215} y={120} scale={1.1} />
      <circle cx="215" cy="116" r="18" fill="none" stroke={GREEN} strokeWidth="4" />
      <circle cx="215" cy="116" r="4" fill={GREEN} />
      <circle
        cx="222"
        cy="44"
        r="14"
        fill="none"
        stroke="#ff4d4d"
        strokeWidth="3"
        strokeDasharray="5 4"
      />
      <Extinguisher x={60} y={136} />
      <path
        d="M98 94 L196 114"
        stroke="#eef5ff"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function SmokeIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill="#2a3240" />
      {[30, 80, 130, 180, 230, 280].map((x, index) => (
        <polygon
          key={x}
          points={`${x - 30},${50 + (index % 2) * 8} ${x},${22 + (index % 3) * 6} ${x + 32},${48 + (index % 2) * 6} ${x + 8},${70}`}
          fill={SMOKE}
          opacity="0.85"
        />
      ))}
      <rect x="0" y="0" width="320" height="30" fill="#6f767d" opacity="0.8" />
      <Person x={120} y={142} crouch />
      <polygon points="200,130 214,122 214,138" fill={GREEN} />
      <polygon points="226,130 240,122 240,138" fill={GREEN} />
      <polygon points="252,130 266,122 266,138" fill={GREEN} />
      <rect x="276" y="96" width="30" height="46" fill="#2f6b4f" />
    </svg>
  );
}

export function LiftIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill="#2a3240" />
      <rect x="40" y="26" width="90" height="118" fill="#6d7885" />
      <rect x="46" y="32" width="38" height="112" fill="#b8c1ca" />
      <rect x="86" y="32" width="38" height="112" fill="#b8c1ca" />
      <line
        x1="30"
        y1="20"
        x2="140"
        y2="150"
        stroke="#ff4d4d"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <line
        x1="140"
        y1="20"
        x2="30"
        y2="150"
        stroke="#ff4d4d"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {[0, 1, 2, 3, 4].map((step) => (
        <rect
          key={step}
          x={180 + step * 22}
          y={140 - step * 22}
          width={130 - step * 22}
          height="22"
          fill={step % 2 === 0 ? '#8a96a3' : '#7a8693'}
        />
      ))}
      <circle cx="292" cy="26" r="14" fill={GREEN} />
      <polyline points="285,26 290,31 299,20" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

export function EscapeIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill="#2a3240" />
      <rect x="20" y="40" width="46" height="104" fill="#3a2a24" />
      <Flames x={60} y={146} scale={1.3} />
      <Flames x={130} y={146} scale={1.1} />
      <Person x={222} y={146} />
      <polygon points="248,90 270,78 270,102" fill={GREEN} />
      <polygon points="272,90 294,78 294,102" fill={GREEN} />
      <rect x="296" y="40" width="16" height="104" fill="#2f6b4f" />
    </svg>
  );
}
