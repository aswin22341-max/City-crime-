import type { SoundSettings } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  private settings: SoundSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    ambientVolume: 0.5,
    muted: false,
  };

  private initialized = false;
  private lastFootstepAt = 0;
  private lastScreechAt = 0;

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.ambientGain = ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Engine synthesizer
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 340;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineSubOsc = ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 28;
      this.engineOsc.connect(engineFilter);
      this.engineSubOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
      this.engineSubOsc.start();

      // Police siren synthesizer
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 660;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.sfxGain);
      this.sirenOsc.start();

      // Rain white-noise loop
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.rainSource = ctx.createBufferSource();
      this.rainSource.buffer = noiseBuffer;
      this.rainSource.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1100;
      rainFilter.Q.value = 0.7;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      this.rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ambientGain);
      this.rainSource.start();

      this.initialized = true;
      this.applySettings();
    } catch {
      // Ignore audio errors on headless/restricted devices
    }
  }

  public setSettings(next: SoundSettings) {
    this.settings = { ...next };
    this.applySettings();
  }

  private applySettings() {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.05);
    this.ambientGain.gain.setTargetAtTime(this.settings.ambientVolume, now, 0.05);
  }

  public updateContinuous(
    inVehicle: boolean,
    speedKmh: number,
    drifting: boolean,
    policePursuitActive: boolean,
    isRaining: boolean,
    elapsedSec: number
  ) {
    if (!this.ctx || !this.initialized) return;
    const now = this.ctx.currentTime;

    if (this.engineOsc && this.engineSubOsc && this.engineGain) {
      if (inVehicle) {
        const rpmRatio = Math.min(1, Math.abs(speedKmh) / 180);
        const freq = 48 + rpmRatio * 135;
        this.engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
        this.engineSubOsc.frequency.setTargetAtTime(freq * 0.5, now, 0.06);
        this.engineGain.gain.setTargetAtTime(0.08 + rpmRatio * 0.1, now, 0.08);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }

    if (this.sirenOsc && this.sirenGain) {
      if (policePursuitActive) {
        const wail = 620 + Math.sin(elapsedSec * 6.5) * 230;
        this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(0.055, now, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.12);
      }
    }

    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(isRaining ? 0.12 : 0, now, 0.3);
    }

    if (drifting && Math.abs(speedKmh) > 35 && elapsedSec - this.lastScreechAt > 0.25) {
      this.lastScreechAt = elapsedSec;
      this.playTireScreech();
    }
  }

  public playFootstep(sprinting: boolean, nowSec: number) {
    if (!this.ctx || !this.sfxGain) return;
    const interval = sprinting ? 0.27 : 0.42;
    if (nowSec - this.lastFootstepAt < interval) return;
    this.lastFootstepAt = nowSec;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playHorn() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.value = 340;
    osc2.frequency.value = 425;
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  public playJump() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playPickup() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + idx * 0.06;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playEmpPulse() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playCollision(intensity: number) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    gain.gain.setValueAtTime(Math.min(0.24, 0.05 + intensity * 0.15), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playMissionComplete() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = n;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playThunder() {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 1.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 1.55);
  }

  private playTireScreech() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.linearRampToValueAtTime(760, now + 0.16);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public dispose() {
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.sirenOsc?.stop();
      this.rainSource?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
  }
}
