// Web Audio API based sound effects for gamification
// No external API required — generates sounds programmatically

export type ClickSoundPreset = 'soft' | 'pop' | 'mechanical' | 'arcade' | 'bubble';

export const CLICK_SOUND_PRESETS: { id: ClickSoundPreset; label: string }[] = [
  { id: 'soft', label: 'Soft Click' },
  { id: 'pop', label: 'Pop' },
  { id: 'mechanical', label: 'Mechanical' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'bubble', label: 'Bubble' },
];

class SoundEffectsService {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = false;
  private clickPreset: ClickSoundPreset = 'soft';

  private async getContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('sfx_enabled', String(enabled));
  }

  isEnabled(): boolean {
    const stored = localStorage.getItem('sfx_enabled');
    if (stored !== null) {
      this.enabled = stored === 'true';
    }
    return this.enabled;
  }

  setClickPreset(preset: ClickSoundPreset) {
    this.clickPreset = preset;
    localStorage.setItem('sfx_click_preset', preset);
  }

  getClickPreset(): ClickSoundPreset {
    const stored = localStorage.getItem('sfx_click_preset') as ClickSoundPreset | null;
    if (stored && CLICK_SOUND_PRESETS.some(p => p.id === stored)) {
      this.clickPreset = stored;
    }
    return this.clickPreset;
  }

  async playXPGain() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1600, now);
      osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.25);
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playBadgeUnlock() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + 0.7);
      });
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2000 + i * 500, now + 0.3);
        gain.gain.setValueAtTime(0.1, now + 0.3 + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5 + i * 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.3 + i * 0.05);
        osc.stop(now + 0.6);
      }
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playLevelUp() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.5, now);
        gain.gain.setValueAtTime(0, now + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now + i * 0.06);
        osc2.start(now + i * 0.06);
        osc1.stop(now + 0.9);
        osc2.stop(now + 0.9);
      });
      const impact = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impact.type = 'sine';
      impact.frequency.setValueAtTime(150, now + 0.4);
      impact.frequency.exponentialRampToValueAtTime(50, now + 0.8);
      impactGain.gain.setValueAtTime(0.3, now + 0.4);
      impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
      impact.connect(impactGain);
      impactGain.connect(ctx.destination);
      impact.start(now + 0.4);
      impact.stop(now + 1);
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playChallengeComplete() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const notes = [783.99, 987.77, 1174.66, 1567.98];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + 0.6);
      });
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playClick(presetOverride?: ClickSoundPreset) {
    if (!this.isEnabled()) return;
    const preset = presetOverride || this.getClickPreset();
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;

      switch (preset) {
        case 'soft': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.05);
          break;
        }
        case 'pop': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.1);
          break;
        }
        case 'mechanical': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.setValueAtTime(200, now + 0.02);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.06);
          break;
        }
        case 'arcade': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(1600, now + 0.04);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.08);
          break;
        }
        case 'bubble': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
          osc.frequency.exponentialRampToValueAtTime(500, now + 0.12);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.15);
          break;
        }
      }
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playNotification() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }

  async playSuccess() {
    if (!this.isEnabled()) return;
    try {
      const ctx = await this.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + 0.3);
      });
    } catch (e) {
      console.log('Sound effect failed:', e);
    }
  }
}

export const soundEffects = new SoundEffectsService();

export const playSound = (sound: 'xp' | 'badge' | 'levelUp' | 'challenge' | 'click' | 'notification' | 'success') => {
  switch (sound) {
    case 'xp': soundEffects.playXPGain(); break;
    case 'badge': soundEffects.playBadgeUnlock(); break;
    case 'levelUp': soundEffects.playLevelUp(); break;
    case 'challenge': soundEffects.playChallengeComplete(); break;
    case 'click': soundEffects.playClick(); break;
    case 'notification': soundEffects.playNotification(); break;
    case 'success': soundEffects.playSuccess(); break;
  }
};