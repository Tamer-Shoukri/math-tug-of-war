/**
 * Synthesized sound effects (WebAudio) — no asset files to load or license.
 * The AudioContext is created lazily on the first user gesture, as browsers
 * require. One shared instance across scenes; `M` toggles mute.
 */

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = localStorage.getItem("mtw-muted") === "1";

  /** Call from any user gesture; safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem("mtw-muted", this.muted ? "1" : "0");
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  private tone(freq: number, dur: number, wave: Wave, gain: number, when = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number, when = 0, q = 0.8): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(filterFreq, t);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  click(): void {
    this.tone(880, 0.05, "square", 0.05);
  }

  countdown(final: boolean): void {
    if (final) {
      this.tone(1046, 0.35, "square", 0.12);
      this.tone(1568, 0.35, "triangle", 0.08, 0.02);
    } else {
      this.tone(660, 0.12, "square", 0.1);
    }
  }

  /** Correct answer: bright two-note chime, rising with streak. */
  correct(streak: number): void {
    const base = 660 * Math.pow(2, Math.min(streak - 1, 7) / 12);
    this.tone(base, 0.12, "triangle", 0.16);
    this.tone(base * 1.5, 0.16, "triangle", 0.12, 0.06);
  }

  /** Rope heave: low filtered whoosh + thump. */
  pull(tier: "normal" | "power" | "mega"): void {
    const heavy = tier === "normal" ? 0 : tier === "power" ? 1 : 2;
    this.noise(0.22 + heavy * 0.08, 0.22 + heavy * 0.08, 500 - heavy * 80);
    this.tone(140 - heavy * 20, 0.18, "sine", 0.3, 0, 70);
    if (heavy > 0) {
      this.tone(523, 0.1, "square", 0.07, 0.05);
      this.tone(784, 0.14, "square", 0.07, 0.11);
      if (heavy > 1) this.tone(1046, 0.18, "square", 0.07, 0.17);
    }
  }

  wrong(): void {
    this.tone(220, 0.22, "sawtooth", 0.12, 0, 140);
    this.tone(180, 0.22, "sawtooth", 0.09, 0.05, 110);
  }

  danger(): void {
    this.tone(300, 0.09, "square", 0.05);
  }

  win(): void {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((n, i) => this.tone(n, i === notes.length - 1 ? 0.6 : 0.16, "triangle", 0.15, i * 0.12));
    this.noise(1.2, 0.08, 2600, 0.1, 0.4); // crowd-ish hiss
  }

  thud(): void {
    this.tone(90, 0.35, "sine", 0.4, 0, 45);
    this.noise(0.3, 0.2, 300);
  }
}

export const sfx = new Sfx();
