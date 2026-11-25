/**
 * @pattern Observer (GoF Comportamental)
 * @role ConcreteSubject
 *
 * Problema de diseño que resuelve:
 * Modela la cuenta regresiva del Escape Room en lógica 100 % pura (sin `window.setInterval`
 * ni temporizadores del navegador). Recibe el paso del tiempo vía `tick(deltaSeconds)` y
 * notifica automáticamente a HUD, iluminación y AudioManager el tiempo formateado `MM:SS`
 * junto con las banderas de estado crítico (`<= 60s`) y expirado (`<= 0s`).
 */

import type { IObserver, ISubject } from '../core/interfaces/IObserver';

/**
 * Instantánea inmutable del temporizador emitida hacia sus observadores.
 */
export interface TimerSnapshot {
  readonly remainingSeconds: number;
  readonly totalSeconds: number;
  readonly formattedTime: string;
  readonly isRunning: boolean;
  readonly isCritical: boolean;
  readonly isExpired: boolean;
}

/**
 * Reloj puro observable encargado de controlar el tiempo límite de la partida.
 */
export class GameTimer implements ISubject<TimerSnapshot> {
  public static readonly CRITICAL_THRESHOLD_SECONDS = 60;

  private totalSeconds: number;
  private remainingSeconds: number;
  private isRunning: boolean;
  private observers: Set<IObserver<TimerSnapshot>>;

  /**
   * Crea un temporizador puro inicializado con el límite de tiempo indicado.
   *
   * @param initialSeconds - Duración total en segundos (por defecto `300`, es decir `05:00`).
   */
  constructor(initialSeconds = 300) {
    this.totalSeconds = Math.max(1, initialSeconds);
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.observers = new Set<IObserver<TimerSnapshot>>();
  }

  /**
   * Inicia o reanuda el conteo regresivo y notifica a los observadores.
   */
  public start(): void {
    if (this.remainingSeconds <= 0) {
      return;
    }
    this.isRunning = true;
    this.notify(this.getSnapshot());
  }

  /**
   * Pausa el conteo regresivo conservando el tiempo restante.
   */
  public pause(): void {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    this.notify(this.getSnapshot());
  }

  /**
   * Reinicia el reloj a su duración total (u otra nueva duración) y lo deja detenido.
   *
   * @param newTotalSeconds - Nueva duración opcional en segundos.
   */
  public reset(newTotalSeconds?: number): void {
    if (newTotalSeconds !== undefined) {
      this.totalSeconds = Math.max(1, newTotalSeconds);
    }
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.notify(this.getSnapshot());
  }

  /**
   * Avanza la simulación del reloj según el delta de tiempo transcurrido.
   *
   * @param deltaSeconds - Segundos transcurridos desde el último frame o paso.
   */
  public tick(deltaSeconds: number): void {
    if (!this.isRunning || deltaSeconds <= 0 || this.remainingSeconds <= 0) {
      return;
    }

    this.remainingSeconds = Math.max(0, this.remainingSeconds - deltaSeconds);

    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.isRunning = false;
    }

    this.notify(this.getSnapshot());
  }

  /**
   * Aplica una penalización de tiempo (por ejemplo tras un fallo grave) y notifica.
   *
   * @param seconds - Segundos a descontar del reloj.
   */
  public penalize(seconds: number): void {
    if (seconds <= 0 || this.remainingSeconds <= 0) {
      return;
    }

    this.remainingSeconds = Math.max(0, this.remainingSeconds - seconds);
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.isRunning = false;
    }

    this.notify(this.getSnapshot());
  }

  public getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  public getTotalSeconds(): number {
    return this.totalSeconds;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Devuelve el tiempo restante formateado como `MM:SS`.
   */
  public getFormattedTime(): string {
    const wholeSeconds = Math.ceil(this.remainingSeconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const seconds = wholeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Indica si el reloj está en umbral crítico (`<= 60` segundos).
   */
  public isCritical(): boolean {
    return this.remainingSeconds <= GameTimer.CRITICAL_THRESHOLD_SECONDS;
  }

  /**
   * Indica si el tiempo límite se agotó (`<= 0` segundos).
   */
  public isExpired(): boolean {
    return this.remainingSeconds <= 0;
  }

  public getSnapshot(): TimerSnapshot {
    return {
      remainingSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
      formattedTime: this.getFormattedTime(),
      isRunning: this.isRunning,
      isCritical: this.isCritical(),
      isExpired: this.isExpired(),
    };
  }

  public attach(observer: IObserver<TimerSnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<TimerSnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: TimerSnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }
}
