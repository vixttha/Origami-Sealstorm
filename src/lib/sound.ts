class ProceduralSoundManager {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private lastPopTime = 0;
  private consecutivePops = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playTowerPlace(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Low sine thud (110Hz -> 45Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    // 2. High-pass filtered noise snap (crisp paper fold)
    const bufferSize = Math.floor(ctx.sampleRate * 0.065);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  public playEnemyPop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastPopTime <= 0.3) {
      this.consecutivePops = Math.min(20, this.consecutivePops + 1);
    } else {
      this.consecutivePops = 0;
    }
    this.lastPopTime = now;

    // Pitch steps up +2% per consecutive pop within 0.3s (capped at +40%)
    const pitchMult = 1 + Math.min(0.4, this.consecutivePops * 0.02);
    const baseFreq = 320 * pitchMult;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.045);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playElementalCombo(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Deep Taiko drum hit
    const taikoOsc = ctx.createOscillator();
    const taikoGain = ctx.createGain();
    taikoOsc.type = 'sine';
    taikoOsc.frequency.setValueAtTime(135, now);
    taikoOsc.frequency.exponentialRampToValueAtTime(48, now + 0.28);

    taikoGain.gain.setValueAtTime(0.32, now);
    taikoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    taikoOsc.connect(taikoGain);
    taikoGain.connect(ctx.destination);
    taikoOsc.start(now);
    taikoOsc.stop(now + 0.34);

    // 2. Pentatonic bell chime (Yo scale notes: D5, F5, G5, A5, C6)
    const notes = [587.33, 698.46, 783.99, 880.0, 1046.5];
    const chimeFreq = notes[Math.floor(Math.random() * notes.length)];

    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(chimeFreq, now + 0.03);

    bellGain.gain.setValueAtTime(0.16, now + 0.03);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.03);
    bellOsc.stop(now + 0.5);
  }

  public playUpgrade(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [440, 554.37, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.045);

      gain.gain.setValueAtTime(0.12, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.17);
    });
  }

  public playWaveStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.11;
      osc.frequency.setValueAtTime(95 + i * 25, start);
      osc.frequency.exponentialRampToValueAtTime(42, start + 0.22);

      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    }
  }

  public silenceAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      // Nothing persistent loops, so audio nodes naturally decay within <0.5s
    }
  }
}

export const soundManager = new ProceduralSoundManager();
