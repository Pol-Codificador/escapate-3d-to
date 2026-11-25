/**
 * @pattern Strategy (GoF Comportamental) + Prototype (GoF Creacional)
 * @role ConcreteStrategy & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Encapsula el algoritmo de validación para acertijos basados en secuencias ordenadas
 * de interruptores (por ejemplo `['B', 'A', 'C']`). Permite acumular pasos de forma
 * incremental, consultar la secuencia parcial, deshacer el último paso (`popStep()`)
 * para soportar `Command.undo()` y clonar su estado sin acoplar la entidad `Puzzle`.
 */

import type { IPrototype } from '../../../core/interfaces/IPrototype';
import type {
  IPuzzleValidationStrategy,
  PuzzleInput,
  ValidationResult,
} from '../../../core/interfaces/IPuzzleValidationStrategy';

/**
 * Estrategia concreta para validar secuencias ordenadas de interruptores.
 */
export class SequenceStrategy
  implements IPuzzleValidationStrategy, IPrototype<SequenceStrategy>
{
  public readonly strategyName = 'SequenceStrategy';

  private readonly expectedSequence: readonly string[];
  private currentSequence: string[];

  /**
   * Crea una estrategia de secuencia con el orden esperado de interruptores.
   *
   * @param expectedSequence - Secuencia exacta esperada (ej. `['B', 'A', 'C']`).
   * @param initialProgress - Pasos parciales opcionales (usado al clonar estado).
   */
  constructor(
    expectedSequence: readonly string[],
    initialProgress: readonly string[] = []
  ) {
    if (expectedSequence.length === 0) {
      throw new Error('SequenceStrategy requiere al menos un paso en expectedSequence.');
    }

    this.expectedSequence = expectedSequence.map((step) => step.trim().toUpperCase());
    this.currentSequence = initialProgress.map((step) => step.trim().toUpperCase());
  }

  /**
   * Agrega un interruptor a la secuencia parcial y evalúa si la combinación es válida.
   *
   * @param switchId - Identificador del interruptor accionado (ej. `'A'`, `'B'`, `'C'`).
   * @returns Resultado con progreso parcial, éxito o reinicio tras fallo.
   */
  public addStep(switchId: string): ValidationResult {
    const normalizedStep = switchId.trim().toUpperCase();
    if (!normalizedStep) {
      return {
        isValid: false,
        message: 'Identificador de interruptor vacío.',
        progress: this.getProgressRatio(),
        shouldResetInput: false,
      };
    }

    this.currentSequence.push(normalizedStep);

    if (this.currentSequence.length < this.expectedSequence.length) {
      return {
        isValid: false,
        message: `Interruptor ${normalizedStep} activado (${this.currentSequence.length}/${this.expectedSequence.length}).`,
        progress: this.getProgressRatio(),
        shouldResetInput: false,
      };
    }

    const matches = this.expectedSequence.every(
      (expectedStep, index) => this.currentSequence[index] === expectedStep
    );

    if (matches) {
      return {
        isValid: true,
        message: `Secuencia correcta (${this.expectedSequence.join(' → ')}). Circuito restablecido.`,
        progress: 1,
        shouldResetInput: false,
      };
    }

    const attempted = this.currentSequence.join(' → ');
    this.currentSequence = [];

    return {
      isValid: false,
      message: `Secuencia incorrecta (${attempted}). El panel se ha reiniciado.`,
      progress: 0,
      shouldResetInput: true,
    };
  }

  /**
   * Devuelve una copia inmutable de la secuencia parcial ingresada hasta el momento.
   */
  public getCurrentSequence(): readonly string[] {
    return [...this.currentSequence];
  }

  /**
   * Devuelve una copia inmutable de la secuencia esperada por la estrategia.
   */
  public getExpectedSequence(): readonly string[] {
    return [...this.expectedSequence];
  }

  /**
   * Revierte y devuelve el último interruptor ingresado para soportar `Command.undo()`.
   *
   * @returns El identificador removido o `undefined` si la secuencia estaba vacía.
   */
  public popStep(): string | undefined {
    return this.currentSequence.pop();
  }

  /**
   * Limpia la secuencia parcial ingresada.
   */
  public reset(): void {
    this.currentSequence = [];
  }

  /**
   * Evalúa un paso individual o una secuencia completa contra el orden esperado.
   *
   * @param input - Paso único (`string`/`number`) o arreglo completo de pasos.
   */
  public validate(input: PuzzleInput): ValidationResult {
    if (Array.isArray(input)) {
      this.reset();
      let lastResult: ValidationResult = {
        isValid: false,
        message: 'Secuencia vacía.',
        progress: 0,
        shouldResetInput: true,
      };

      for (const step of input) {
        lastResult = this.addStep(String(step));
        if (lastResult.shouldResetInput) {
          break;
        }
      }

      return lastResult;
    }

    return this.addStep(String(input));
  }

  /**
   * Clona profundamente la estrategia incluyendo el progreso parcial actual.
   */
  public clone(): SequenceStrategy {
    return new SequenceStrategy(this.expectedSequence, this.currentSequence);
  }

  private getProgressRatio(): number {
    return this.currentSequence.length / this.expectedSequence.length;
  }
}
