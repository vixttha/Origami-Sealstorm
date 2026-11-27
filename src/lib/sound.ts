/**
 * Runic Origami & Ink - zero-asset procedural Web Audio synthesizer.
 * Folds, pops, taiko drums and pentatonic chimes are synthesized at runtime;
 * the AudioContext is created lazily on the first user gesture and released
 * cleanly when the engine is destroyed.
 */

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPopAt = -1;
  private popChain = 0;
  muted = false;

  /** Lazily initialize the AudioContext (must be called from a user gesture). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          typeof window !== 'undefined' ? window.AudioContext : undefined;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  /** Silence and dispose all audio nodes cleanly. */
  release(): void {
    try {
      if (this.master) this.master.disconnect();
      if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    } catch {
      // already closed
    }
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.popChain = 0;
  }

  private ready(): boolean {
    return this.ctx !== null && this.master !== null && !this.muted;
  }

  private tone(
    freq: number,
    endFreq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseBurst(dur: number, filterFreq: number, gain: number, highpass: boolean, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = highpass ? 'highpass' : 'lowpass';
    filter.frequency.value = filterFreq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Tower place: low sine thud 110Hz -> 45Hz + paper-fold noise snap. */
  place(): void {
    if (!this.ready()) return;
    this.tone(110, 45, 0.22, 'sine', 0.5);
    this.noiseBurst(0.06, 1400, 0.32, true);
  }

  /** Enemy pop: pluck whose pitch steps up +2% per consecutive pop (cap +40%). */
  pop(): void {
    if (!this.ready()) return;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.lastPopAt >= 0 && now - this.lastPopAt <= 0.3) {
      this.popChain = Math.min(20, this.popChain + 1);
    } else {
      this.popChain = 0;
    }
    this.lastPopAt = now;
    const mult = 1 + Math.min(0.4, this.popChain * 0.02);
    this.tone(520 * mult, 500 * mult, 0.16, 'triangle', 0.26);
    this.noiseBurst(0.04, 2400, 0.1, true);
  }

  /** Elemental combo: deep taiko drum + pentatonic bell chime. */
  combo(index: number): void {
    if (!this.ready()) return;
    this.tone(85, 48, 0.3, 'sine', 0.7);
    this.noiseBurst(0.12, 220, 0.4, false);
    const note = PENTATONIC[index % PENTATONIC.length];
    this.tone(note, note, 0.5, 'sine', 0.16, 0.04);
    this.tone(note * 1.5, note * 1.5, 0.4, 'sine', 0.07, 0.08);
  }

  wave(): void {
    if (!this.ready()) return;
    this.tone(70, 45, 0.4, 'sine', 0.55);
    this.tone(PENTATONIC[4], PENTATONIC[4], 0.4, 'sine', 0.12, 0.05);
  }

  leak(): void {
    if (!this.ready()) return;
    this.tone(300, 110, 0.25, 'sawtooth', 0.16);
  }

  upgrade(): void {
    if (!this.ready()) return;
    this.tone(392, 392, 0.1, 'triangle', 0.2);
    this.tone(523.25, 523.25, 0.18, 'triangle', 0.22, 0.09);
    this.noiseBurst(0.05, 1800, 0.1, true, 0.02);
  }

  salvage(): void {
    if (!this.ready()) return;
    this.tone(520, 392, 0.12, 'triangle', 0.18);
    this.tone(392, 262, 0.16, 'triangle', 0.15, 0.1);
  }

  error(): void {
    if (!this.ready()) return;
    this.tone(120, 120, 0.07, 'square', 0.12);
    this.tone(95, 95, 0.09, 'square', 0.12, 0.09);
  }

  ui(): void {
    if (!this.ready()) return;
    this.tone(660, 660, 0.05, 'sine', 0.08);
  }

  victory(): void {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, n, 0.34, 'triangle', 0.2, i * 0.13));
  }

  defeat(): void {
    if (!this.ready()) return;
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => this.tone(n, n * 0.96, 0.4, 'sine', 0.2, i * 0.18));
  }
}

export const sound = new SoundEngine();
