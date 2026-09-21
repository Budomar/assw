class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private initialized = false;

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.initialized = true;
    } catch {
      console.warn('Web Audio API not supported');
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio errors
    }
  }

  private playSequence(notes: Array<{ freq: number; duration: number; delay: number }>, type: OscillatorType = 'sine', volume = 0.12) {
    if (!this.enabled || !this.ctx) return;
    notes.forEach(({ freq, duration, delay }) => {
      setTimeout(() => this.playTone(freq, duration, type, volume), delay);
    });
  }

  eat() {
    this.playSequence([
      { freq: 523, duration: 0.1, delay: 0 },
      { freq: 659, duration: 0.1, delay: 50 },
    ], 'sine', 0.1);
  }

  eatGolden() {
    this.playSequence([
      { freq: 523, duration: 0.08, delay: 0 },
      { freq: 659, duration: 0.08, delay: 60 },
      { freq: 784, duration: 0.08, delay: 120 },
      { freq: 1047, duration: 0.15, delay: 180 },
    ], 'sine', 0.12);
  }

  eatBonus() {
    this.playSequence([
      { freq: 440, duration: 0.08, delay: 0 },
      { freq: 554, duration: 0.08, delay: 50 },
      { freq: 659, duration: 0.08, delay: 100 },
      { freq: 880, duration: 0.2, delay: 150 },
    ], 'triangle', 0.12);
  }

  powerUp() {
    this.playSequence([
      { freq: 330, duration: 0.1, delay: 0 },
      { freq: 440, duration: 0.1, delay: 80 },
      { freq: 550, duration: 0.1, delay: 160 },
      { freq: 660, duration: 0.1, delay: 240 },
      { freq: 880, duration: 0.2, delay: 320 },
    ], 'sine', 0.1);
  }

  die() {
    this.playSequence([
      { freq: 440, duration: 0.15, delay: 0 },
      { freq: 350, duration: 0.15, delay: 100 },
      { freq: 260, duration: 0.15, delay: 200 },
      { freq: 180, duration: 0.4, delay: 300 },
    ], 'sawtooth', 0.08);
  }

  combo(level: number) {
    const baseFreq = 400 + level * 80;
    this.playSequence([
      { freq: baseFreq, duration: 0.08, delay: 0 },
      { freq: baseFreq * 1.25, duration: 0.08, delay: 40 },
      { freq: baseFreq * 1.5, duration: 0.12, delay: 80 },
    ], 'sine', 0.08);
  }

  levelUp() {
    this.playSequence([
      { freq: 523, duration: 0.1, delay: 0 },
      { freq: 659, duration: 0.1, delay: 100 },
      { freq: 784, duration: 0.1, delay: 200 },
      { freq: 1047, duration: 0.3, delay: 300 },
    ], 'sine', 0.12);
  }

  click() {
    this.playTone(800, 0.05, 'sine', 0.05);
  }

  pause() {
    this.playTone(300, 0.1, 'sine', 0.08);
  }

  resume() {
    this.playTone(500, 0.1, 'sine', 0.08);
  }
}

export const audioManager = new AudioManager();
