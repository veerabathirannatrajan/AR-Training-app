/** Flat icons for the PPE tray cards (match the 3D gear; no text, so every language works). */
export function PpeIcon({ id, size = 44 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {ICONS[id] ?? <circle cx="24" cy="24" r="14" fill="#8a96a3" />}
    </svg>
  );
}

const ICONS: Record<string, JSX.Element> = {
  helmet: (
    <g>
      <path d="M8 31 Q8 13 24 13 Q40 13 40 31 Z" fill="#ffc93c" />
      <path d="M24 13 Q30 13 34 18 L30 31 L24 31 Z" fill="#f2b21f" />
      <rect x="21" y="10" width="6" height="21" rx="2" fill="#f2b21f" />
      <rect x="4" y="30" width="40" height="5" rx="2.5" fill="#e6a817" />
    </g>
  ),
  'dust-mask': (
    <g>
      <path
        d="M6 20 L14 22 M42 20 L34 22 M8 32 L15 29 M40 32 L33 29"
        stroke="#8a96a3"
        strokeWidth="2"
      />
      <path d="M14 18 Q24 12 34 18 L34 30 Q24 40 14 30 Z" fill="#f2f4f6" />
      <path d="M24 15 L24 36" stroke="#cfd4da" strokeWidth="2" />
      <circle cx="24" cy="26" r="3" fill="#cfd4da" />
    </g>
  ),
  'breathing-apparatus': (
    <g>
      <rect x="5" y="10" width="11" height="30" rx="5" fill="#2b2f35" />
      <rect x="5" y="15" width="11" height="4" fill="#ffc93c" />
      <path d="M16 30 Q22 34 24 28" stroke="#1d1f22" strokeWidth="2.5" fill="none" />
      <path d="M22 14 Q34 8 42 16 L42 32 Q34 40 22 32 Z" fill="#1d2228" />
      <path d="M26 17 Q34 13 39 19 L39 25 Q32 27 26 25 Z" fill="#7fb8e6" />
      <circle cx="32" cy="32" r="3" fill="#3a434d" />
    </g>
  ),
  'gas-detector': (
    <g>
      <rect x="13" y="6" width="22" height="36" rx="5" fill="#ffc93c" />
      <rect x="17" y="11" width="14" height="12" rx="2" fill="#10161d" />
      <rect x="19" y="13" width="4" height="3" fill="#34d17a" />
      <rect x="25" y="13" width="4" height="3" fill="#34d17a" />
      <rect x="19" y="18" width="4" height="3" fill="#34d17a" />
      <rect x="25" y="18" width="4" height="3" fill="#ff4d4d" />
      <circle cx="24" cy="31" r="4" fill="#2b3139" />
      <rect x="21" y="2" width="6" height="5" rx="1" fill="#2b3139" />
    </g>
  ),
  torch: (
    <g>
      <path d="M30 14 L44 6 L44 30 L30 22 Z" fill="#fff3a3" opacity="0.7" />
      <rect x="10" y="14" width="20" height="8" rx="2" fill="#6d7885" />
      <rect x="4" y="15" width="7" height="6" rx="1.5" fill="#4a535e" />
      <rect x="15" y="12" width="4" height="3" fill="#d62828" />
      <path d="M24 30 L18 40 L23 40 L20 46 L30 34 L25 34 L28 30 Z" fill="#ff7a1a" />
    </g>
  ),
  harness: (
    <g>
      <path d="M14 8 L34 40 M34 8 L14 40" stroke="#1f6feb" strokeWidth="5" strokeLinecap="round" />
      <path d="M10 24 L38 24" stroke="#1f6feb" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="10" r="4" fill="none" stroke="#b8c1ca" strokeWidth="2.5" />
      <path d="M24 6 Q38 2 42 12 Q44 20 38 22" stroke="#ff7a1a" strokeWidth="2.5" fill="none" />
    </g>
  ),
};
