/**
 * @pattern Singleton (GoF Creacional) + Observer (GoF Comportamental)
 * @role Singleton & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Garantiza un único punto de acceso controlado para la síntesis procedural de efectos
 * sonoros mediante Web Audio API (sin archivos MP3 externos) y reacciona de manera
 * desacoplada a eventos de `GameTimer`, `Puzzle` e `Inventory` implementando `IObserver`.
 */

import type { IObserver } from '../interfaces/IObserver';
import type { ThemeAudioConfig } from '../interfaces/IThemeFactory';
import type { InventorySnapshot } from '../../model/entities/Inventory';
import type { TimerSnapshot } from '../../model/GameTimer';
import type { PuzzleSnapshot } from '../../model/puzzles/Puzzle';

/**
 * Identificadores de efectos sonoros procedurales soportados por `AudioManager`.
 */
export type SoundEffectType =
  | 'click'
  | 'switch_toggle'
  | 'pin_key'
  | 'error'
  | 'success'
  | 'item_pickup'
  | 'door_open'
  | 'critical_heartbeat';

/**
 * Unión discriminable de instantáneas que `AudioManager` puede observar.
 */
export type ObservableAudioEvent =
  | TimerSnapshot
  | PuzzleSnapshot
  | InventorySnapshot;

interface AudioContextConstructorLike {
  new (): AudioContext;
}

/**
 * Gestor único de audio procedural protegido contra entornos sin `AudioContext`
 * o políticas de autoplay previas a la primera interacción del usuario.
 */
export class AudioManager implements IObserver<ObservableAudioEvent> {
  private static instance: AudioManager | null = null;

  private audioContext: AudioContext | null;
  private isMuted: boolean;
  private themeAudioConfig: ThemeAudioConfig | null;
  private lastCriticalSecond: number | null;
  private playedSoundsCount: number;
  private lastPlayedSound: SoundEffectType | null;

  private constructor() {
    this.audioContext = null;
    this.isMuted = false;
    this.themeAudioConfig = null;
    this.lastCriticalSecond = null;
    this.playedSoundsCount = 0;
    this.lastPlayedSound = null;
  }

  /**
   * Devuelve la instancia única de `AudioManager` (Patrón Singleton).
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Configura la firma acústica de la temática activa producida por `IThemeFactory`.
   */
  public setThemeAudioConfig(config: ThemeAudioConfig): void {
    this.themeAudioConfig = config;
    this.lastCriticalSecond = null;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getPlayedSoundsCount(): number {
    return this.playedSoundsCount;
  }

  public getLastPlayedSound(): SoundEffectType | null {
    return this.lastPlayedSound;
  }

  public resetTracking(): void {
    this.lastCriticalSecond = null;
  }

  /**
   * Desbloquea o reanuda el `AudioContext` tras una interacción explícita del usuario.
   */
  public unlockAudio(): void {
    try {
      const ctx = this.ensureAudioContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }
    } catch {
      // Silencio seguro si el entorno no dispone de Web Audio API.
    }
  }

  /**
   * Reacciona automáticamente a notificaciones de `GameTimer`, `Puzzle` e `Inventory`.
   */
  public update(data: ObservableAudioEvent): void {
    if ('remainingSeconds' in data) {
      this.handleTimerSnapshot(data);
      return;
    }

    if ('puzzleId' in data) {
      this.handlePuzzleSnapshot(data);
      return;
    }

    if ('selectedSlotIndex' in data) {
      this.handleInventorySnapshot(data);
    }
  }

  public playClick(): void {
    this.playTone('click', 620, 0.045, 'sine', 0.08);
  }

  public playSwitchToggle(): void {
    const baseFreq = this.themeAudioConfig?.interactionBeepFrequencyHz ?? 440;
    this.playTone('switch_toggle', baseFreq, 0.08, 'triangle', 0.11);
  }

  public playPinKey(): void {
    const baseFreq = this.themeAudioConfig?.interactionBeepFrequencyHz ?? 760;
    this.playTone('pin_key', baseFreq * 1.1, 0.055, 'sine', 0.09);
  }

  public playError(): void {
    this.playTone('error', 150, 0.22, 'sawtooth', 0.12);
  }

  public playSuccess(): void {
    this.playTone('success', 523.25, 0.12, 'triangle', 0.12);
    this.playTone('success', 659.25, 0.16, 'triangle', 0.12, 0.09);
  }

  public playItemPickup(): void {
    this.playTone('item_pickup', 587.33, 0.09, 'sine', 0.11);
    this.playTone('item_pickup', 880, 0.14, 'sine', 0.11, 0.07);
  }

  public playDoorOpen(): void {
    this.playTone('door_open', 220, 0.28, 'triangle', 0.14);
    this.playTone('door_open', 330, 0.32, 'sine', 0.12, 0.14);
  }

  public playCriticalHeartbeat(): void {
    const multiplier = this.themeAudioConfig?.tensionMultiplier ?? 1.2;
    this.playTone('critical_heartbeat', 68 * multiplier, 0.12, 'sine', 0.16);
    this.playTone('critical_heartbeat', 54 * multiplier, 0.14, 'sine', 0.12, 0.13);
  }

  private handleTimerSnapshot(snapshot: TimerSnapshot): void {
    if (!snapshot.isRunning || snapshot.isExpired || !snapshot.isCritical) {
      if (!snapshot.isCritical) {
        this.lastCriticalSecond = null;
      }
      return;
    }

    const currentWholeSecond = Math.ceil(snapshot.remainingSeconds);
    if (currentWholeSecond !== this.lastCriticalSecond) {
      this.lastCriticalSecond = currentWholeSecond;
      this.playCriticalHeartbeat();
    }
  }

  private handlePuzzleSnapshot(snapshot: PuzzleSnapshot): void {
    switch (snapshot.eventType) {
      case 'solved':
        if (snapshot.puzzleId === 'exit_puzzle') {
          this.playDoorOpen();
        } else {
          this.playSuccess();
        }
        break;
      case 'attempt_failed':
        this.playError();
        break;
      case 'progress':
      case 'step_undone':
        this.playSwitchToggle();
        break;
      default:
        break;
    }
  }

  private handleInventorySnapshot(snapshot: InventorySnapshot): void {
    if (snapshot.eventType === 'item_added') {
      this.playItemPickup();
    } else if (snapshot.eventType === 'item_selected') {
      this.playClick();
    }
  }

  private playTone(
    soundType: SoundEffectType,
    frequencyHz: number,
    durationSeconds: number,
    waveform: OscillatorType,
    volume: number,
    delaySeconds = 0
  ): void {
    this.playedSoundsCount += 1;
    this.lastPlayedSound = soundType;

    if (this.isMuted) {
      return;
    }

    try {
      const ctx = this.ensureAudioContext();
      if (!ctx || ctx.state === 'suspended') {
        return;
      }

      const startTime = ctx.currentTime + delaySeconds;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequencyHz, startTime);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + durationSeconds
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + durationSeconds + 0.02);
    } catch {
      // Protección ante ausencia o bloqueo de Web Audio API.
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    try {
      const scope = globalThis as {
        AudioContext?: AudioContextConstructorLike;
        webkitAudioContext?: AudioContextConstructorLike;
      };
      const AudioCtor = scope.AudioContext ?? scope.webkitAudioContext;
      if (!AudioCtor) {
        return null;
      }
      this.audioContext = new AudioCtor();
      return this.audioContext;
    } catch {
      return null;
    }
  }
}
