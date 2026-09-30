/** App mark: a faceted low-poly safety helmet (same artwork as the app icon). */
export function AppMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className="app-mark">
      <rect width="512" height="512" rx="112" fill="#11151c" />
      <polygon points="256,312 106,312 126.1,237" fill="#e8650c" />
      <polygon points="256,312 126.1,237 181,182.1" fill="#ff8a3d" />
      <polygon points="256,312 181,182.1 256,162" fill="#ffa15c" />
      <polygon points="256,312 256,162 331,182.1" fill="#ff7a1a" />
      <polygon points="256,312 331,182.1 385.9,237" fill="#f26d10" />
      <polygon points="256,312 385.9,237 406,312" fill="#d95f0e" />
      <polygon points="240,168 272,168 268,300 244,300" fill="#ffc08a" opacity="0.55" />
      <polygon points="76,312 436,312 414,344 98,344" fill="#c2540b" />
    </svg>
  );
}
