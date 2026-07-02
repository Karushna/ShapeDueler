export type SoundType = 'correct' | 'wrong' | 'levelup' | 'complete';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function scheduleNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(dest);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

function tone(freq: number, start: number, dur: number, vol = 0.3, type: OscillatorType = 'sine'): void {
  const ctx = getCtx();
  scheduleNote(ctx, ctx.destination, freq, start, dur, vol, type);
}

// ─── Sound Effects ───────────────────────────────────────────────────────────

export function playSound(type: SoundType): void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    switch (type) {
      case 'correct':
        // 3-note rising sparkle — C5 E5 G5
        tone(523, t,        0.20, 0.26);
        tone(659, t + 0.10, 0.20, 0.28);
        tone(784, t + 0.20, 0.35, 0.32);
        break;

      case 'wrong':
        // Low thud + descending sawtooth buzz
        tone(220, t,        0.10, 0.44, 'sawtooth');
        tone(185, t + 0.06, 0.28, 0.32, 'square');
        tone(130, t + 0.18, 0.28, 0.26, 'sawtooth');
        break;

      case 'levelup': {
        // Whoosh sweep 150 → 800 Hz, then chord hit, then scale run to C6
        const ctx2 = getCtx();
        const t2 = ctx2.currentTime;
        const whoosh = ctx2.createOscillator();
        const wg = ctx2.createGain();
        whoosh.connect(wg);
        wg.connect(ctx2.destination);
        whoosh.type = 'sine';
        whoosh.frequency.setValueAtTime(150, t2);
        whoosh.frequency.exponentialRampToValueAtTime(800, t2 + 0.28);
        wg.gain.setValueAtTime(0.18, t2);
        wg.gain.linearRampToValueAtTime(0, t2 + 0.34);
        whoosh.start(t2);
        whoosh.stop(t2 + 0.38);
        // Chord punch at t+0.22
        tone(523, t2 + 0.22, 0.42, 0.28);
        tone(659, t2 + 0.22, 0.42, 0.22);
        tone(784, t2 + 0.22, 0.42, 0.18);
        // Ascending run → C6
        tone(523,  t2 + 0.42, 0.10, 0.26);
        tone(659,  t2 + 0.52, 0.10, 0.28);
        tone(784,  t2 + 0.62, 0.10, 0.28);
        tone(1047, t2 + 0.72, 0.55, 0.34);
        break;
      }

      case 'complete':
        // Triumphant 8-note fanfare
        tone(392,  t,        0.12, 0.30);
        tone(523,  t + 0.13, 0.12, 0.30);
        tone(659,  t + 0.26, 0.12, 0.30);
        tone(523,  t + 0.39, 0.09, 0.28);
        tone(659,  t + 0.48, 0.09, 0.32);
        tone(784,  t + 0.57, 0.09, 0.32);
        tone(1047, t + 0.66, 0.75, 0.38);
        // Harmony chord underneath the final note
        tone(523,  t + 0.66, 0.75, 0.22);
        tone(784,  t + 0.66, 0.75, 0.18);
        break;
    }
  } catch {
    // Audio unavailable — silently skip
  }
}

// ─── Background Music ────────────────────────────────────────────────────────
// Three-layer loop: chord pad + bass line + two-voice melody
// C major pentatonic: C4 E4 G4 A4 C5

const MELODY_FREQS = [261.63, 329.63, 392.00, 440.00, 523.25];
// 16-step melodic pattern (scale indices) — wave motion up and back
const PATTERN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 1, 3, 2, 4, 3, 2];
const BPM = 96;
const BEAT = 60 / BPM; // 0.625 s

let bgGain: GainNode | null = null;
let bgScheduler: ReturnType<typeof setInterval> | null = null;
let bgStep = 0;
let bgNextBeat = 0;

function bgLoop(): void {
  const dest = bgGain;
  if (!dest) return;
  const ctx = getCtx();
  const LOOKAHEAD = 0.3;

  const sched = (freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'triangle') =>
    scheduleNote(ctx, dest, freq, start, dur, vol, type);

  while (bgNextBeat < ctx.currentTime + LOOKAHEAD) {
    const idx = PATTERN[bgStep % PATTERN.length] ?? 0;
    const freq = MELODY_FREQS[idx] ?? 261.63;

    // Melody voice — triangle wave (geometric, clean)
    sched(freq, bgNextBeat, BEAT * 0.76, 0.52);

    // Harmony voice — diatonic third above (2 scale steps up)
    const harmIdx = Math.min(idx + 2, MELODY_FREQS.length - 1);
    sched(MELODY_FREQS[harmIdx] ?? freq, bgNextBeat, BEAT * 0.68, 0.28);

    const beat = bgStep % 8;

    // Bass line — C3 / G3 / F3 walking pattern
    if (beat === 0) sched(130.81, bgNextBeat, BEAT * 3.8, 0.42, 'sine'); // C3
    if (beat === 4) sched(196.00, bgNextBeat, BEAT * 1.8, 0.36, 'sine'); // G3
    if (beat === 6) sched(174.61, bgNextBeat, BEAT * 1.6, 0.30, 'sine'); // F3

    // Chord pad — very soft sustained C4+G4 every 8 beats
    if (beat === 0) {
      sched(261.63, bgNextBeat, BEAT * 7.5, 0.07, 'sine'); // C4
      sched(392.00, bgNextBeat, BEAT * 7.5, 0.05, 'sine'); // G4
    }

    bgNextBeat += BEAT;
    bgStep++;
  }
}

export function startBgMusic(): void {
  stopBgMusic();
  try {
    const ctx = getCtx();
    bgGain = ctx.createGain();
    bgGain.gain.setValueAtTime(0.10, ctx.currentTime);
    bgGain.connect(ctx.destination);
    bgStep = 0;
    bgNextBeat = ctx.currentTime + 0.15;
    bgScheduler = setInterval(bgLoop, 100);
  } catch {
    // Audio unavailable
  }
}

export function stopBgMusic(): void {
  if (bgScheduler !== null) {
    clearInterval(bgScheduler);
    bgScheduler = null;
  }
  if (bgGain) {
    try {
      const ctx = getCtx();
      bgGain.gain.setValueAtTime(bgGain.gain.value, ctx.currentTime);
      bgGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    } catch { /* ignore */ }
    bgGain = null;
  }
}
