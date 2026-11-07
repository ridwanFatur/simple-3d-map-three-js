/**
 * Realistic Vehicle Engine Sound Service using Web Audio API.
 * Handles browser autoplay policies, multi-layered engine audio (idle rumble + acceleration roar),
 * dynamic pitch and volume modulation according to speed, smooth transitions, and clean disposal.
 */

export class CarAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private engineBuffer: AudioBuffer | null = null;
  private accelBuffer: AudioBuffer | null = null;
  private brakeBuffer: AudioBuffer | null = null;

  private engineSource: AudioBufferSourceNode | null = null;
  private accelSource: AudioBufferSourceNode | null = null;

  private engineGain: GainNode | null = null;
  private accelGain: GainNode | null = null;

  private brakeCooldown = 0;
  private isUnlocked = false;
  private isDisposed = false;
  private unlockListener: (() => void) | null = null;

  constructor() {
    this.setupUnlockListeners();
  }

  private setupUnlockListeners() {
    const unlock = () => {
      if (this.isDisposed) return;
      this.initAudioContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.removeUnlockListeners();
    };

    this.unlockListener = unlock;
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private removeUnlockListeners() {
    if (this.unlockListener) {
      window.removeEventListener('keydown', this.unlockListener);
      window.removeEventListener('pointerdown', this.unlockListener);
      window.removeEventListener('touchstart', this.unlockListener);
      this.unlockListener = null;
    }
  }

  private initAudioContext() {
    if (this.ctx || this.isDisposed) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Fade in master gain smoothly
    this.masterGain.gain.exponentialRampToValueAtTime(0.85, this.ctx.currentTime + 0.5);

    void this.loadBuffers();
  }

  private async loadBuffers() {
    if (!this.ctx || this.isDisposed) return;

    const load = async (url: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        if (!this.ctx) return null;
        return await this.ctx.decodeAudioData(arrayBuf);
      } catch (err) {
        console.warn(`Failed to load audio from ${url}:`, err);
        return null;
      }
    };

    const [engineBuf, accelBuf, brakeBuf] = await Promise.all([
      load('/sounds/engine.mp3'),
      load('/sounds/accelerate.mp3'),
      load('/sounds/brake.mp3'),
    ]);

    if (this.isDisposed || !this.ctx) return;

    this.engineBuffer = engineBuf;
    this.accelBuffer = accelBuf;
    this.brakeBuffer = brakeBuf;

    this.startEngineLoops();
    this.isUnlocked = true;
  }

  private startEngineLoops() {
    if (!this.ctx || !this.masterGain || this.isDisposed) return;

    // 1. Idle / Engine Loop
    if (this.engineBuffer) {
      this.engineSource = this.ctx.createBufferSource();
      this.engineSource.buffer = this.engineBuffer;
      this.engineSource.loop = true;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.engineSource.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineSource.start(0);
    }

    // 2. Acceleration Roar Loop
    if (this.accelBuffer) {
      this.accelSource = this.ctx.createBufferSource();
      this.accelSource.buffer = this.accelBuffer;
      this.accelSource.loop = true;

      this.accelGain = this.ctx.createGain();
      this.accelGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.accelSource.connect(this.accelGain);
      this.accelGain.connect(this.masterGain);
      this.accelSource.start(0);
    }
  }

  /**
   * Updates audio playback parameters in real-time according to vehicle speed and user inputs.
   */
  public update(dt: number, speed: number, maxSpeed: number, isAccelerating: boolean, isBraking: boolean) {
    if (!this.ctx || !this.isUnlocked || this.isDisposed) {
      if (isAccelerating || isBraking || Math.abs(speed) > 1) {
        if (!this.ctx) this.initAudioContext();
        if (this.ctx?.state === 'suspended') void this.ctx.resume();
      }
      return;
    }

    const now = this.ctx.currentTime;
    const absSpeed = Math.abs(speed);
    const speedRatio = Math.min(1, absSpeed / maxSpeed);

    // Smooth RPM simulation (increases with speed and throttle)
    const throttleBoost = isAccelerating ? 0.35 : 0;
    const rpm = Math.min(1.0, speedRatio * 0.85 + throttleBoost);

    // 1. Modulate Engine Idle / Base Loop
    if (this.engineSource && this.engineGain) {
      // Pitch: from 0.8x at rest to 2.1x at max speed
      const enginePitch = 0.8 + rpm * 1.3;
      this.engineSource.playbackRate.setTargetAtTime(enginePitch, now, 0.08);

      // Volume: solid base sound that softens slightly when high accel roar takes over
      const engineVol = 0.55 - speedRatio * 0.15;
      this.engineGain.gain.setTargetAtTime(Math.max(0.2, engineVol), now, 0.08);
    }

    // 2. Modulate Acceleration Roar
    if (this.accelSource && this.accelGain) {
      const accelPitch = 0.85 + rpm * 1.45;
      this.accelSource.playbackRate.setTargetAtTime(accelPitch, now, 0.08);

      // Volume blends in heavily when user is pressing gas or vehicle is at high speed
      const targetAccelVol = isAccelerating ? 0.2 + speedRatio * 0.55 : speedRatio * 0.25;
      this.accelGain.gain.setTargetAtTime(targetAccelVol, now, 0.1);
    }

    // 3. One-shot brake friction sound on hard braking at speed
    this.brakeCooldown -= dt;
    if (isBraking && absSpeed > 60 && this.brakeCooldown <= 0 && this.brakeBuffer && this.masterGain) {
      this.playBrakeSound(now, speedRatio);
      this.brakeCooldown = 0.6;
    }
  }

  private playBrakeSound(time: number, intensity: number) {
    if (!this.ctx || !this.brakeBuffer || !this.masterGain || this.isDisposed) return;
    try {
      const brakeSrc = this.ctx.createBufferSource();
      brakeSrc.buffer = this.brakeBuffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.min(0.7, 0.3 + intensity * 0.4), time);
      brakeSrc.connect(gain);
      gain.connect(this.masterGain);
      brakeSrc.start(time);
    } catch {
      // Ignore one-shot error
    }
  }

  /**
   * Cleanly disposes audio nodes and context without abrupt audio pops.
   */
  public dispose() {
    this.isDisposed = true;
    this.removeUnlockListeners();

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.1);

      setTimeout(() => {
        try {
          if (this.engineSource) {
            this.engineSource.stop();
            this.engineSource.disconnect();
          }
          if (this.accelSource) {
            this.accelSource.stop();
            this.accelSource.disconnect();
          }
          if (this.ctx && this.ctx.state !== 'closed') {
            void this.ctx.close();
          }
        } catch {
          // Ignore close errors
        }
      }, 120);
    }
  }
}
