/**
 * @pattern Strategy (Context) + Observer (Subject) + Prototype (GoF)
 * @role Context, ConcreteSubject & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Representa un acertijo desacoplado de su algoritmo concreto de validación (Strategy),
 * emite notificaciones automáticas de progreso, fallo o resolución a sus observadores
 * (puerta, luces, audio, HUD) mediante `ISubject`, y soporta clonación profunda
 * (`IPrototype`) para reiniciar partidas al instante.
 */

import type { IObserver, ISubject } from '../../core/interfaces/IObserver';
import type { IPrototype } from '../../core/interfaces/IPrototype';
import type {
  IPuzzleValidationStrategy,
  PuzzleInput,
  ValidationResult,
} from '../../core/interfaces/IPuzzleValidationStrategy';
import { SequenceStrategy } from './strategies/SequenceStrategy';

/**
 * Eventos emitidos por `Puzzle` hacia sus observadores suscritos.
 */
export type PuzzleEventType =
  | 'progress'
  | 'attempt_failed'
  | 'solved'
  | 'step_undone'
  | 'strategy_changed'
  | 'reset';

/**
 * Instantánea inmutable del estado de un acertijo emitida en cada notificación Observer.
 */
export interface PuzzleSnapshot {
  readonly puzzleId: string;
  readonly title: string;
  readonly description: string;
  readonly isSolved: boolean;
  readonly attempts: number;
  readonly progress: number;
  readonly strategyName: string;
  readonly lastMessage: string;
  readonly eventType: PuzzleEventType;
}

/**
 * Propiedades iniciales para construir una instancia de `Puzzle`.
 */
export interface PuzzleConfig {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly strategy: IPuzzleValidationStrategy;
  readonly isSolved?: boolean;
  readonly attempts?: number;
  readonly progress?: number;
  readonly lastMessage?: string;
}

/**
 * Entidad de dominio que coordina la evaluación de un acertijo y notifica sus cambios.
 */
export class Puzzle implements ISubject<PuzzleSnapshot>, IPrototype<Puzzle> {
  private readonly id: string;
  private readonly title: string;
  private readonly description: string;
  private strategy: IPuzzleValidationStrategy;
  private isSolved: boolean;
  private attempts: number;
  private progress: number;
  private lastMessage: string;
  private observers: Set<IObserver<PuzzleSnapshot>>;

  /**
   * Construye un acertijo con su estrategia inicial de validación.
   *
   * @param config - Configuración inicial del acertijo.
   */
  constructor(config: PuzzleConfig) {
    this.id = config.id;
    this.title = config.title;
    this.description = config.description;
    this.strategy = config.strategy;
    this.isSolved = config.isSolved ?? false;
    this.attempts = config.attempts ?? 0;
    this.progress = config.progress ?? (this.isSolved ? 1 : 0);
    this.lastMessage = config.lastMessage ?? '';
    this.observers = new Set<IObserver<PuzzleSnapshot>>();
  }

  public getId(): string {
    return this.id;
  }

  public getTitle(): string {
    return this.title;
  }

  public getDescription(): string {
    return this.description;
  }

  public getIsSolved(): boolean {
    return this.isSolved;
  }

  public getAttempts(): number {
    return this.attempts;
  }

  public getProgress(): number {
    return this.progress;
  }

  public getLastMessage(): string {
    return this.lastMessage;
  }

  /**
   * Devuelve la estrategia de validación actualmente asignada.
   */
  public getStrategy(): IPuzzleValidationStrategy {
    return this.strategy;
  }

  /**
   * Intercambia la estrategia de validación en tiempo de ejecución (Patrón Strategy).
   *
   * @param strategy - Nueva estrategia concreta que implementa `IPuzzleValidationStrategy`.
   */
  public setStrategy(strategy: IPuzzleValidationStrategy): void {
    this.strategy = strategy;
    this.progress = this.isSolved ? 1 : 0;
    this.lastMessage = `Estrategia cambiada a ${strategy.strategyName}.`;
    this.notify(this.createSnapshot('strategy_changed'));
  }

  /**
   * Ejecuta un intento de resolución delegando la validación a la estrategia actual
   * y notificando a todos los observadores el resultado.
   *
   * @param input - Entrada ingresada por el jugador.
   * @returns Resultado estructurado de validación.
   */
  public attempt(input: PuzzleInput): ValidationResult {
    if (this.isSolved) {
      const alreadySolvedResult: ValidationResult = {
        isValid: true,
        message: 'Este acertijo ya fue resuelto.',
        progress: 1,
        shouldResetInput: false,
      };
      return alreadySolvedResult;
    }

    this.attempts += 1;
    const result = this.strategy.validate(input);
    this.lastMessage = result.message;

    if (result.isValid) {
      this.isSolved = true;
      this.progress = 1;
      this.notify(this.createSnapshot('solved'));
      return result;
    }

    const nextProgress = result.progress ?? 0;
    this.progress = nextProgress;

    const eventType: PuzzleEventType =
      nextProgress > 0 && !result.shouldResetInput ? 'progress' : 'attempt_failed';
    this.notify(this.createSnapshot(eventType));

    return result;
  }

  /**
   * Revierte el último paso cuando la estrategia activa soporta secuencia paso a paso
   * (soporte directo para `Command.undo()`).
   *
   * @returns `true` si se revirtió un paso, `false` en caso contrario.
   */
  public undoLastStep(): boolean {
    if (this.isSolved || !(this.strategy instanceof SequenceStrategy)) {
      return false;
    }

    const removedStep = this.strategy.popStep();
    if (!removedStep) {
      return false;
    }

    const expectedLength = this.strategy.getExpectedSequence().length;
    const currentLength = this.strategy.getCurrentSequence().length;
    this.progress = expectedLength > 0 ? currentLength / expectedLength : 0;
    this.lastMessage = `Último interruptor (${removedStep}) revertido.`;
    this.notify(this.createSnapshot('step_undone'));

    return true;
  }

  /**
   * Restablece el acertijo y su estrategia a su estado inicial sin resolver.
   */
  public reset(): void {
    this.isSolved = false;
    this.attempts = 0;
    this.progress = 0;
    this.lastMessage = 'Acertijo reiniciado.';
    this.strategy.reset?.();
    this.notify(this.createSnapshot('reset'));
  }

  /**
   * Obtiene una instantánea actual del estado del acertijo.
   */
  public getSnapshot(eventType: PuzzleEventType = 'progress'): PuzzleSnapshot {
    return this.createSnapshot(eventType);
  }

  public attach(observer: IObserver<PuzzleSnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<PuzzleSnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: PuzzleSnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }

  /**
   * Crea una copia profunda e independiente del acertijo y de su estrategia.
   * La lista de observadores inicia vacía para evitar referencias cruzadas entre partidas.
   */
  public clone(): Puzzle {
    const clonedStrategy = this.strategy.clone
      ? this.strategy.clone()
      : this.strategy;

    return new Puzzle({
      id: this.id,
      title: this.title,
      description: this.description,
      strategy: clonedStrategy,
      isSolved: this.isSolved,
      attempts: this.attempts,
      progress: this.progress,
      lastMessage: this.lastMessage,
    });
  }

  private createSnapshot(eventType: PuzzleEventType): PuzzleSnapshot {
    return {
      puzzleId: this.id,
      title: this.title,
      description: this.description,
      isSolved: this.isSolved,
      attempts: this.attempts,
      progress: this.progress,
      strategyName: this.strategy.strategyName,
      lastMessage: this.lastMessage,
      eventType,
    };
  }
}
