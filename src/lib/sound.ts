/** Zero-asset procedural Web Audio synthesizer. Everything is a no-op until initAudio() runs on a user gesture. */
import { loadMuted, saveMuted } from './storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let mutedLoaded = false;
let popChain = 0;
let lastPop = -10;
let lastPopPlayed = -10;
let lastShot = -10;
const active = new Set<AudioScheduledSourceNode>();

type AudioCtor = typeof AudioContext;

export function initAudio(): void {
  if (typeof window === 'undefined') return;
  if (!mutedLoaded) {
    muted = loadMuted();
    mutedLoaded = true;
  }
  if (!ctx) {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function isMuted(): boolean {
  if (!mutedLoaded && typeof window !== 'undefined') {
    muted = loadMuted();
    mutedLoaded = true;
  }
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  mutedLoaded = true;
  saveMuted(m);
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
}

function track(src: AudioScheduledSourceNode): void {
  active.add(src);
  src.onended = () => active.delete(src);
}

function ready(): boolean {
  return !!ctx && !!master && !muted && ctx.state !== 'closed';
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
  track(o);
}

function noise(dur: number, vol: number, hp: number, delay = 0): void {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
  track(s);
}

export function playPlace(): void {
  if (!ready()) return;
  tone('sine', 110, 45, 0.28, 0.7);
  noise(0.09, 0.35, 3200);
}

export function playUpgrade(): void {
  if (!ready()) return;
  tone('triangle', 520, 780, 0.18, 0.25);
  tone('sine', 780, 1170, 0.25, 0.18, 0.08);
  noise(0.05, 0.2, 4500);
}

export function playSell(): void {
  if (!ready()) return;
  tone('triangle', 600, 300, 0.2, 0.25);
}

export function playPop(now: number): void {
  if (!ready() || !ctx) return;
  if (now - lastPopPlayed < 0.03) return;
  lastPopPlayed = now;
  popChain = now - lastPop < 0.3 ? popChain + 1 : 0;
  lastPop = now;
  const mult = 1 + Math.min(0.4, popChain * 0.02);
  tone('triangle', 620 * mult, 420 * mult, 0.12, 0.22);
  tone('sine', 1240 * mult, 900 * mult, 0.06, 0.07);
}

export function playShot(now: number): void {
  if (!ready()) return;
  if (now - lastShot < 0.06) return;
  lastShot = now;
  noise(0.04, 0.05, 6000);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export function playCombo(): void {
  if (!ready()) return;
  tone('sine', 150, 55, 0.4, 0.9);
  noise(0.12, 0.25, 800);
  const n = PENTA[Math.floor(Math.random() * PENTA.length)];
  tone('sine', n, n, 0.9, 0.3, 0.05);
  tone('triangle', n * 2, n * 2, 0.6, 0.12, 0.05);
}

export function playLeak(): void {
  if (!ready()) return;
  tone('sawtooth', 180, 70, 0.35, 0.3);
}

export function playWave(): void {
  if (!ready()) return;
  tone('sine', 120, 60, 0.3, 0.8);
  tone('sine', 120, 60, 0.3, 0.6, 0.18);
}

export function playVictory(): void {
  if (!ready()) return;
  [0, 2, 3, 5].forEach((idx, i) => tone('triangle', PENTA[idx], PENTA[idx], 0.7, 0.3, i * 0.16));
}

export function playDefeat(): void {
  if (!ready()) return;
  tone('sine', 200, 40, 1.2, 0.7);
}

/** Stop and disconnect every live node. Safe to call repeatedly. */
export function silenceAll(): void {
  for (const s of Array.from(active)) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
    try {
      s.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  active.clear();
  popChain = 0;
}
