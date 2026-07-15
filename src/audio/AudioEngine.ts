import type { GameEvent } from '../game/types';

type WebAudioContext = AudioContext;

export class AudioEngine {
  private context: WebAudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master !== null) {
      this.master.gain.setTargetAtTime(enabled ? 0.32 : 0, this.master.context.currentTime, 0.025);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async activate(): Promise<void> {
    if (this.context === null) {
      this.createContext();
    }
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  public play(event: GameEvent): void {
    if (!this.enabled || this.context === null || this.master === null) return;
    switch (event.type) {
      case 'move':
        this.tone(92, 0.035, 'sine', 0.025, 78);
        break;
      case 'dig':
        this.noise(0.055, 0.025, 900);
        break;
      case 'collect':
        this.chord([660, 990, 1320], 0.24, 0.055);
        break;
      case 'disk-pickup':
        this.chord([220, 440, 880], 0.2, 0.04);
        break;
      case 'disk-deploy':
        this.tone(130, 0.18, 'square', 0.04, 65);
        break;
      case 'push':
        this.tone(72, 0.09, 'triangle', 0.045, 42);
        break;
      case 'impact':
        this.tone(48, 0.12, 'sine', 0.07, 25);
        this.noise(0.07, 0.035, 360);
        break;
      case 'enemy':
        // Sentinels advance continuously, so movement audio becomes a rhythmic
        // background loop when several are active. Keep autonomous motion silent.
        return;
      case 'exit-open':
        this.chord([220, 330, 440, 660], 0.65, 0.045);
        break;
      case 'explode':
        this.noise(0.48, 0.13, 560);
        this.tone(52, 0.5, 'sine', 0.12, 24);
        break;
      case 'death':
        this.tone(260, 0.6, 'sawtooth', 0.08, 38);
        this.noise(0.35, 0.07, 720);
        break;
      case 'win':
        this.chord([261.6, 329.6, 392, 523.2], 1.1, 0.055);
        window.setTimeout(() => this.chord([329.6, 415.3, 493.9, 659.3], 0.85, 0.045), 220);
        break;
    }
  }

  public dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private createContext(): void {
    const AudioContextConstructor = window.AudioContext;
    const context = new AudioContextConstructor();
    const master = context.createGain();
    master.gain.value = this.enabled ? 0.32 : 0;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
  }

  private tone(
    startFrequency: number,
    duration: number,
    waveform: OscillatorType,
    volume: number,
    endFrequency = startFrequency,
  ): void {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private chord(frequencies: readonly number[], duration: number, volume: number): void {
    frequencies.forEach((frequency, index) => {
      window.setTimeout(
        () => this.tone(frequency, duration, 'sine', volume / frequencies.length, frequency * 1.005),
        index * 28,
      );
    });
  }

  private noise(duration: number, volume: number, filterFrequency: number): void {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }
}
