import { LANGUAGES, type LanguageCode, type LocalizedText } from '@ar-training/shared';
import { create } from 'zustand';
import { readLocal, writeLocal } from '../lib/localStore';

/**
 * Voice narration for every instruction.
 *
 * Order of preference for language L:
 *   1. recorded audio  src/assets/audio/{L}/{id}.mp3   (drop files in; bundled + precached)
 *   2. for Santali: recorded Hindi audio, then Hindi text-to-speech (no Santali TTS voice exists)
 *   3. Web Speech API text-to-speech in L
 */

const recordings = import.meta.glob<string>('../assets/audio/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

function recordingUrl(lang: LanguageCode, id: string): string | undefined {
  return recordings[`../assets/audio/${lang}/${id}.mp3`];
}

export interface Narration {
  /** Stable id, also the audio file name, e.g. "ar-basics.tap-cone". */
  id: string;
  text: Partial<Record<LanguageCode, string>> & { en: string };
}

export function narrationFromText(id: string, text: LocalizedText): Narration {
  return { id, text: { en: text.en, hi: text.hi, ...(text.sat ? { sat: text.sat.text } : {}) } };
}

const MUTED_KEY = 'armt.voiceMuted';

interface NarratorState {
  muted: boolean;
  speaking: boolean;
  setMuted: (muted: boolean) => void;
}

export const useNarratorStore = create<NarratorState>()((set) => ({
  muted: readLocal(MUTED_KEY) === '1',
  speaking: false,
  setMuted: (muted) => {
    writeLocal(MUTED_KEY, muted ? '1' : '0');
    if (muted) stopSpeaking();
    set({ muted });
  },
}));

let currentAudio: HTMLAudioElement | null = null;
/** Pending items when narration is queued (e.g. "Correct!" then the next instruction). */
let queue: Array<() => void> = [];
let busy = false;

function setSpeaking(speaking: boolean) {
  busy = speaking;
  if (useNarratorStore.getState().speaking !== speaking) useNarratorStore.setState({ speaking });
}

function finished() {
  setSpeaking(false);
  const next = queue.shift();
  next?.();
}

function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(lang: LanguageCode): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const tag = LANGUAGES[lang].bcp47.toLowerCase();
  const base = tag.split('-')[0] ?? tag;
  const normalise = (voice: SpeechSynthesisVoice) => voice.lang.replace('_', '-').toLowerCase();
  return (
    voices.find((voice) => normalise(voice) === tag) ??
    voices.find((voice) => normalise(voice).startsWith(`${base}-`) || normalise(voice) === base)
  );
}

function playRecording(url: string) {
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = finished;
  audio.onerror = finished;
  setSpeaking(true);
  audio.play().catch(finished);
}

function speakText(text: string, lang: LanguageCode) {
  if (!speechSupported()) {
    finished();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGES[lang].bcp47;
  const voice = pickVoice(lang);
  if (voice != null) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.onend = finished;
  utterance.onerror = finished;
  setSpeaking(true);
  window.speechSynthesis.speak(utterance);
}

function play(narration: Narration, lang: LanguageCode) {
  const own = recordingUrl(lang, narration.id);
  if (own != null) return playRecording(own);
  if (lang === 'sat') {
    const hindiRecording = recordingUrl('hi', narration.id);
    if (hindiRecording != null) return playRecording(hindiRecording);
    return speakText(narration.text.hi ?? narration.text.en, 'hi');
  }
  speakText(narration.text[lang] ?? narration.text.en, lang);
}

export function stopSpeaking(): void {
  queue = [];
  if (currentAudio != null) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio = null;
  }
  if (speechSupported()) window.speechSynthesis.cancel();
  setSpeaking(false);
}

/**
 * Speaks a narration. By default it interrupts whatever is playing; with `queue: true` it
 * waits for the current narration to finish.
 */
export function speak(
  narration: Narration,
  lang: LanguageCode,
  options: { queue?: boolean } = {},
): void {
  if (useNarratorStore.getState().muted) return;
  if (options.queue === true && busy) {
    queue.push(() => play(narration, lang));
    return;
  }
  stopSpeaking();
  play(narration, lang);
}

// Chrome loads voices asynchronously; touching getVoices() early starts that.
if (speechSupported()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () =>
    window.speechSynthesis.getVoices(),
  );
}
