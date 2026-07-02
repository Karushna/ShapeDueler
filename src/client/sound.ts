export type SoundType = 'correct' | 'wrong' | 'levelup' | 'complete';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.28,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

export function playSound(type: SoundType): void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    switch (type) {
      case 'correct':
        // Two rising tones — C5 → G5
        tone(ctx, 523, t, 0.22);
        tone(ctx, 784, t + 0.13, 0.28);
        break;

      case 'wrong':
        // Descending sawtooth buzz — D4 → A3
        tone(ctx, 294, t, 0.15, 0.28, 'sawtooth');
        tone(ctx, 196, t + 0.12, 0.28, 0.22, 'sawtooth');
        break;

      case 'levelup':
        // Quick 3-note fanfare — G4 → C5 → E5
        tone(ctx, 392, t, 0.14);
        tone(ctx, 523, t + 0.11, 0.14);
        tone(ctx, 659, t + 0.22, 0.24);
        break;

      case 'complete':
        // Victory arpeggio — C5 E5 G5 C6
        tone(ctx, 523, t, 0.18);
        tone(ctx, 659, t + 0.12, 0.18);
        tone(ctx, 784, t + 0.24, 0.18);
        tone(ctx, 1047, t + 0.36, 0.45);
        break;
    }
  } catch {
    // Audio unavailable — silently skip
  }
}
