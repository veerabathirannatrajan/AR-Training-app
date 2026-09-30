/**
 * Procedural sound effects (Web Audio): no audio files, so they work offline and cost nothing
 * to download. Everything is quiet by default and starts only after a user gesture.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (context == null) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
  return master == null ? null : { ctx: context, out: master };
}

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer == null) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0,
) {
  const a = audio();
  if (a == null) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(out);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

interface Loop {
  stop: () => void;
  setLevel?: (level: number) => void;
}

/** Filtered noise loop (fire crackle, extinguisher hiss). */
function noiseLoop(
  filterType: BiquadFilterType,
  frequency: number,
  volume: number,
  crackle: boolean,
): Loop | null {
  const a = audio();
  if (a == null) return null;
  const { ctx, out } = a;
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.25);
  source.connect(filter).connect(gain).connect(out);
  source.start();

  let level = 1;
  let timer: number | null = null;
  if (crackle) {
    // Random pops on top of the roar.
    timer = window.setInterval(() => {
      if (Math.random() < 0.55 * level)
        tone(120 + Math.random() * 500, 0.05, 'square', 0.05 * level);
    }, 90);
  }
  return {
    setLevel(next) {
      level = Math.max(0, Math.min(1, next));
      gain.gain.setTargetAtTime(volume * level, ctx.currentTime, 0.2);
    },
    stop() {
      if (timer != null) window.clearInterval(timer);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      source.stop(ctx.currentTime + 0.6);
    },
  };
}

/** Two-tone fire alarm siren. */
function sirenLoop(): Loop | null {
  const a = audio();
  if (a == null) return null;
  const { ctx, out } = a;
  const oscillator = ctx.createOscillator();
  oscillator.type = 'square';
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  oscillator.connect(gain).connect(out);
  const now = ctx.currentTime;
  for (let i = 0; i < 120; i += 1) {
    oscillator.frequency.setValueAtTime(i % 2 === 0 ? 960 : 740, now + i * 0.45);
  }
  oscillator.start();
  return {
    stop() {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      oscillator.stop(ctx.currentTime + 0.5);
    },
  };
}

export const sfx = {
  tap: () => tone(880, 0.06, 'triangle', 0.08),
  success: () => {
    tone(660, 0.12, 'sine', 0.12);
    tone(990, 0.2, 'sine', 0.12, 0.1);
  },
  error: () => tone(180, 0.25, 'sawtooth', 0.09),
  critical: () => {
    tone(140, 0.45, 'sawtooth', 0.14);
    tone(110, 0.55, 'sawtooth', 0.12, 0.2);
  },
  pinPull: () => {
    tone(1400, 0.05, 'square', 0.06);
    tone(2100, 0.08, 'triangle', 0.05, 0.04);
  },
  cough: () => {
    const a = audio();
    if (a == null) return;
    const { ctx, out } = a;
    for (const delay of [0, 0.22]) {
      const source = ctx.createBufferSource();
      source.buffer = noise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      source.connect(filter).connect(gain).connect(out);
      source.start(start);
      source.stop(start + 0.2);
    }
  },
  fire: () => noiseLoop('lowpass', 900, 0.18, true),
  hiss: () => noiseLoop('highpass', 2500, 0.16, false),
  siren: () => sirenLoop(),
};

/** Short vibration patterns (Android Chrome supports navigator.vibrate). */
export const haptic = {
  tap: () => vibrate(12),
  success: () => vibrate([18, 40, 18]),
  error: () => vibrate([60, 40, 60]),
  critical: () => vibrate([200, 80, 200, 80, 300]),
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional.
  }
}
