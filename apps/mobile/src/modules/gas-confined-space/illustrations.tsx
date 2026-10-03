/*
 * Flat, low-poly style illustrations for the gas module's scenario quiz (inline SVG: offline,
 * crisp; only chemical symbols as text, so they work in every language).
 */

const BG = '#2a3240';
const GAS = '#cbdc6e';
const SKIN = '#c98b5f';
const VEST = '#ff7a1a';
const DARK = '#1d2530';
const GREEN = '#22c55e';
const RED = '#ff4d4d';
const GROUND = '#59616b';
const PIT = '#0b0d10';
const TRIPOD = '#e0a800';

function Person({ x, y, vest = VEST }: { x: number; y: number; vest?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-78" r="9" fill={SKIN} />
      <path d="M-10 -84 Q0 -96 10 -84 Z" fill="#ffc93c" />
      <polygon points="-11,-68 11,-68 13,-34 -13,-34" fill={vest} />
      <polygon points="-11,-34 -1,-34 -3,0 -12,0" fill={DARK} />
      <polygon points="1,-34 11,-34 12,0 3,0" fill={DARK} />
    </g>
  );
}

function Puff({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <polygon
      points={`${x - r},${y} ${x - r * 0.4},${y - r * 0.8} ${x + r * 0.5},${y - r * 0.7} ${x + r},${y} ${x + r * 0.3},${y + r * 0.6} ${x - r * 0.5},${y + r * 0.5}`}
      fill={GAS}
      opacity="0.75"
    />
  );
}

function Ground({ pitX }: { pitX?: number }) {
  return (
    <g>
      <rect x="0" y="118" width="320" height="42" fill={GROUND} />
      {pitX != null && (
        <g>
          <rect x={pitX - 24} y="118" width="48" height="42" fill={PIT} />
          <rect x={pitX - 30} y="112" width="8" height="8" fill="#a3a9b0" />
          <rect x={pitX + 22} y="112" width="8" height="8" fill="#a3a9b0" />
        </g>
      )}
    </g>
  );
}

function Tripod({ x }: { x: number }) {
  return (
    <g>
      <line x1={x - 34} y1="118" x2={x} y2="30" stroke={TRIPOD} strokeWidth="5" />
      <line x1={x + 34} y1="118" x2={x} y2="30" stroke={TRIPOD} strokeWidth="5" />
      <rect x={x - 22} y="66" width="14" height="14" fill="#c0392b" />
      <circle cx={x} cy="34" r="6" fill="#b8c1ca" />
    </g>
  );
}

/** Testing a pit from outside: monitor in hand, probe hose down the manhole. */
export function TestOrderIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill={BG} />
      <Ground pitX={200} />
      {[0, 1, 2].map((index) => (
        <Puff key={index} x={192 + index * 9} y={140 + index * 6} r={9} />
      ))}
      <Person x={110} y={118} />
      <rect x="122" y="54" width="22" height="34" rx="4" fill="#ffc93c" />
      <rect x="126" y="58" width="14" height="14" rx="2" fill="#10161d" />
      <rect x="128" y="60" width="4" height="4" fill={RED} />
      <rect x="134" y="60" width="4" height="4" fill={RED} />
      <rect x="128" y="66" width="4" height="4" fill={GREEN} />
      <rect x="134" y="66" width="4" height="4" fill={RED} />
      <path d="M140 56 Q190 40 200 150" stroke="#1d1f22" strokeWidth="3" fill="none" />
    </svg>
  );
}

/** Heavy gas from a leaking pipe flowing along the ground into a drain. */
export function HeavyGasIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill={BG} />
      <polygon points="200,30 290,30 300,44 190,44" fill="#6d7885" />
      <Ground pitX={236} />
      <rect x="20" y="100" width="140" height="10" fill="#f2c230" />
      <rect x="70" y="96" width="10" height="18" fill="#c99a1c" />
      <path d="M82 98 L104 90" stroke="#f4f8ff" strokeWidth="5" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Puff key={index} x={110 + index * 22} y={112 - (index % 2) * 4} r={11} />
      ))}
      {[0, 1, 2].map((index) => (
        <Puff key={`pit-${index}`} x={230 + index * 6} y={132 + index * 9} r={10} />
      ))}
      <path d="M150 122 L210 128" stroke={GAS} strokeWidth="3" strokeDasharray="6 5" />
      <polygon points="214,128 204,122 204,134" fill={GAS} />
    </svg>
  );
}

/** A light switch in a gas cloud: crossed out. */
export function NoSwitchIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill={BG} />
      {[0, 1, 2, 3, 4].map((index) => (
        <Puff key={index} x={40 + index * 60} y={110 - (index % 2) * 20} r={26} />
      ))}
      <rect x="130" y="30" width="60" height="90" rx="8" fill="#e9ecef" />
      <rect x="148" y="48" width="24" height="54" rx="5" fill="#cfd4da" />
      <rect x="151" y="52" width="18" height="22" rx="3" fill="#8a96a3" />
      <path d="M200 26 L212 46 L204 46 L214 66" stroke="#ffd23f" strokeWidth="4" fill="none" />
      <circle cx="160" cy="75" r="58" fill="none" stroke={RED} strokeWidth="9" />
      <line x1="119" y1="34" x2="201" y2="116" stroke={RED} strokeWidth="9" />
    </svg>
  );
}

/** The attendant at the top with a radio, the entrant below on a lifeline. */
export function AttendantIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill={BG} />
      <rect x="0" y="80" width="320" height="80" fill={GROUND} />
      <rect x="176" y="80" width="56" height="80" fill={PIT} />
      <Tripod x={204} />
      <line x1="204" y1="36" x2="204" y2="118" stroke={VEST} strokeWidth="3" />
      <g transform="translate(204 160) scale(0.6)">
        <circle cx="0" cy="-78" r="9" fill={SKIN} />
        <polygon points="-11,-68 11,-68 13,-34 -13,-34" fill={VEST} />
        <polygon points="-11,-34 11,-34 8,0 -8,0" fill={DARK} />
      </g>
      <Person x={110} y={80} vest="#c6e34a" />
      <rect x="120" y="22" width="8" height="16" rx="2" fill="#22272e" />
      <path
        d="M136 22 Q146 30 136 38 M142 16 Q156 30 142 44"
        stroke={GREEN}
        strokeWidth="3"
        fill="none"
      />
      <circle cx="292" cy="26" r="14" fill={GREEN} />
      <polyline points="285,26 290,31 299,20" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

/** Rescue from outside with the tripod winch; climbing in is crossed out. */
export function RescueIllustration() {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <rect width="320" height="160" rx="16" fill={BG} />
      <rect x="0" y="100" width="320" height="60" fill={GROUND} />
      <rect x="66" y="100" width="48" height="60" fill={PIT} />
      <rect x="216" y="100" width="48" height="60" fill={PIT} />
      <Tripod x={90} />
      <line x1="90" y1="36" x2="90" y2="96" stroke={VEST} strokeWidth="3" />
      <g transform="translate(90 132) scale(0.55)">
        <circle cx="0" cy="-78" r="9" fill={SKIN} />
        <polygon points="-11,-68 11,-68 13,-34 -13,-34" fill={VEST} />
        <polygon points="-11,-34 11,-34 8,0 -8,0" fill={DARK} />
      </g>
      <circle cx="148" cy="30" r="14" fill={GREEN} />
      <polyline points="141,30 146,35 155,24" fill="none" stroke="#fff" strokeWidth="3" />
      <Person x={240} y={140} />
      <line x1="200" y1="30" x2="282" y2="150" stroke={RED} strokeWidth="9" strokeLinecap="round" />
      <line x1="282" y1="30" x2="200" y2="150" stroke={RED} strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}
