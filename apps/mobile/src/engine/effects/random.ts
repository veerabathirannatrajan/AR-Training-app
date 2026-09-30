/** Deterministic pseudo-random numbers so effects look the same on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth noise in [-1, 1] from a few sines (good enough for flicker). */
export function flicker(t: number, phase: number): number {
  return (
    Math.sin(t * 7.3 + phase) * 0.5 +
    Math.sin(t * 13.1 + phase * 1.7) * 0.3 +
    Math.sin(t * 3.1 + phase * 0.6) * 0.2
  );
}
