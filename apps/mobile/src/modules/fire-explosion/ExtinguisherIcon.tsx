import { EXTINGUISHER_STYLE, type ExtinguisherType } from './extinguishers';

/** Flat extinguisher illustration for tray cards (matches the 3D colour bands). */
export function ExtinguisherIcon({ type, size = 56 }: { type: ExtinguisherType; size?: number }) {
  const style = EXTINGUISHER_STYLE[type];
  return (
    <svg width={size * 0.62} height={size} viewBox="0 0 40 64" aria-hidden>
      {/* hose */}
      <path
        d={style.horn ? 'M24 12 C34 14 34 26 33 34' : 'M24 12 C32 14 33 24 31 30'}
        fill="none"
        stroke="#1d1f22"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {style.horn ? (
        <polygon points="30,33 36,33 38,44 28,44" fill="#1d1f22" />
      ) : (
        <rect x="29.5" y="29" width="3" height="6" rx="1" fill="#1d1f22" />
      )}
      {/* handle and valve */}
      <rect x="14" y="5" width="12" height="3" rx="1.5" fill="#2b2f35" />
      <rect x="16.5" y="8" width="7" height="6" rx="1" fill="#2b2f35" />
      <circle cx="27" cy="10" r="2.4" fill="none" stroke="#cfd4da" strokeWidth="1.2" />
      {/* body */}
      <path
        d="M11 20 Q11 14 20 14 Q29 14 29 20 L29 58 Q29 61 26 61 L14 61 Q11 61 11 58 Z"
        fill="#d62828"
      />
      <path d="M11 20 Q11 14 20 14 L20 61 L14 61 Q11 61 11 58 Z" fill="#b71c1c" opacity="0.55" />
      <rect x="11" y="30" width="18" height="9" fill={style.band} />
      <rect x="13" y="42" width="14" height="10" rx="1.5" fill="#f5f5f5" opacity="0.9" />
      <rect x="11" y="58" width="18" height="3" fill="#1d1f22" />
    </svg>
  );
}
