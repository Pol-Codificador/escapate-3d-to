/**
 * @pattern Strategy (GoF Comportamental)
 * @role Strategy Contract
 *
 * Problema de diseño que resuelve:
 * Desacopla las reglas de validación de cada acertijo (secuencia de interruptores,
 * código PIN numérico, desbloqueo por ítem) de la entidad Puzzle que las utiliza.
 * Permite intercambiar o extender algoritmos de validación sin condicionales rígidos
 * ni herencia explosiva.
 */

/**
 * Tipos de entrada admitidos por las estrategias de validación de acertijos.
 */
export type PuzzleInput = string | number | readonly (string | number)[];

/**
 * Resultado estructurado producido al validar un intento del jugador.
 */
export interface ValidationResult {
  /** Indica si el acertijo quedó resuelto con la entrada proporcionada. */
  readonly isValid: boolean;
  /** Mensaje de retroalimentación para mostrar en HUD o bitácora. */
  readonly message: string;
  /** Progreso normalizado opcional entre `0` y `1` (útil en secuencias parciales). */
  readonly progress?: number;
  /** Indica si el input acumulado del acertijo debe reiniciarse tras un fallo. */
  readonly shouldResetInput?: boolean;
}

/**
 * Contrato común para las estrategias de validación de acertijos del Escape Room.
 */
export interface IPuzzleValidationStrategy {
  /** Nombre identificador legible de la estrategia concreta. */
  readonly strategyName: string;

  /**
   * Evalúa la entrada del jugador contra las reglas de la estrategia.
   *
   * @param input - Entrada introducida por el jugador (código, secuencia o id de ítem).
   * @returns Resultado tipado con validez, mensaje y metadatos opcionales.
   */
  validate(input: PuzzleInput): ValidationResult;

  /**
   * Reinicia el estado interno acumulado de la estrategia (ej. pasos parciales).
   */
  reset?(): void;

  /**
   * Crea una copia independiente de la estrategia preservando su configuración.
   */
  clone?(): IPuzzleValidationStrategy;
}
