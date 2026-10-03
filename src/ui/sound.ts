/** Tiny synthesised sound effects (Web Audio, no audio files). */
type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function play(notes: Note[]): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const start = now + n.at;
    const peak = n.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

export const sfx = {
  correct: () =>
    play([
      { freq: 660, at: 0, dur: 0.14 },
      { freq: 990, at: 0.08, dur: 0.22 },
    ]),
  wrong: () =>
    play([
      { freq: 220, at: 0, dur: 0.18, type: 'triangle', gain: 0.1 },
      { freq: 180, at: 0.1, dur: 0.22, type: 'triangle', gain: 0.1 },
    ]),
  hint: () => play([{ freq: 520, at: 0, dur: 0.12, type: 'triangle', gain: 0.07 }]),
  click: () => play([{ freq: 440, at: 0, dur: 0.05, gain: 0.05 }]),
  finish: () =>
    play([
      { freq: 523, at: 0, dur: 0.18 },
      { freq: 659, at: 0.12, dur: 0.18 },
      { freq: 784, at: 0.24, dur: 0.18 },
      { freq: 1047, at: 0.36, dur: 0.4 },
    ]),
};
