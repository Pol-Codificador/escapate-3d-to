/**
 * @pattern Strategy (GoF Comportamental) + Prototype (GoF Creacional)
 * @role ConcreteStrategy & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Desacopla la validación de códigos numéricos de 4 dígitos (caja fuerte o terminal
 * criogénica) de la entidad `Puzzle`, permitiendo configurar el PIN por temática y
 * clonar la estrategia limpiamente al reiniciar la sala.
 */

import type { IPrototype } from '../../../core/interfaces/IPrototype';
import type {
  IPuzzleValidationStrategy,
  PuzzleInput,
  ValidationResult,
} from '../../../core/interfaces/IPuzzleValidationStrategy';

/**
 * Estrategia concreta para validar un código PIN numérico de 4 dígitos.
 */
export class PinCodeStrategy
  implements IPuzzleValidationStrategy, IPrototype<PinCodeStrategy>
{
  public readonly strategyName = 'PinCodeStrategy';

  private readonly expectedPin: string;

  /**
   * Crea una estrategia de validación para un PIN de 4 dígitos.
   *
   * @param expectedPin - Cadena numérica exacta de 4 dígitos (ej. `'4829'`).
   */
  constructor(expectedPin: string) {
    const normalizedPin = expectedPin.trim();
    if (!/^\d{4}$/.test(normalizedPin)) {
      throw new Error(
        `PinCodeStrategy requiere un PIN numérico de exactamente 4 dígitos; recibido: "${expectedPin}".`
      );
    }

    this.expectedPin = normalizedPin;
  }

  /**
   * Devuelve el código PIN esperado (solo para depuración controlada o clonación).
   */
  public getExpectedPin(): string {
    return this.expectedPin;
  }

  /**
   * Valida que la entrada corresponda a 4 dígitos numéricos y coincida con el PIN configurado.
   *
   * @param input - Código introducido como texto, número o arreglo de dígitos.
   */
  public validate(input: PuzzleInput): ValidationResult {
    const normalizedInput = Array.isArray(input)
      ? input.map((digit) => String(digit).trim()).join('')
      : String(input).trim();

    if (!/^\d{4}$/.test(normalizedInput)) {
      return {
        isValid: false,
        message: 'Ingresa un código numérico válido de 4 dígitos.',
        progress: 0,
        shouldResetInput: true,
      };
    }

    if (normalizedInput === this.expectedPin) {
      return {
        isValid: true,
        message: `Código ${normalizedInput} aceptado. Mecanismo desbloqueado.`,
        progress: 1,
        shouldResetInput: false,
      };
    }

    return {
      isValid: false,
      message: `Código ${normalizedInput} incorrecto. Acceso denegado.`,
      progress: 0,
      shouldResetInput: true,
    };
  }

  /**
   * Restablece estado interno (sin estado acumulable en PIN directo).
   */
  public reset(): void {
    // Estrategia sin estado parcial persistente; el teclado de la Vista limpia su buffer.
  }

  /**
   * Crea una copia independiente de la estrategia con el mismo PIN configurado.
   */
  public clone(): PinCodeStrategy {
    return new PinCodeStrategy(this.expectedPin);
  }
}
