/**
 * @pattern Strategy (GoF Comportamental) + Prototype (GoF Creacional)
 * @role ConcreteStrategy & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Encapsula la regla de desbloqueo mediante un objeto del inventario (`itemId`),
 * permitiendo validar si la llave o tarjeta entregada abre una cerradura o puerta
 * sin acoplar el acertijo a la clase `Inventory` ni a los nombres concretos de cada tema.
 */

import type { IPrototype } from '../../../core/interfaces/IPrototype';
import type {
  IPuzzleValidationStrategy,
  PuzzleInput,
  ValidationResult,
} from '../../../core/interfaces/IPuzzleValidationStrategy';

/**
 * Estrategia concreta que valida si el jugador entregó el ítem requerido.
 */
export class ItemUnlockStrategy
  implements IPuzzleValidationStrategy, IPrototype<ItemUnlockStrategy>
{
  public readonly strategyName = 'ItemUnlockStrategy';

  private readonly requiredItemId: string;
  private readonly requiredItemLabel: string;

  /**
   * Crea una estrategia de desbloqueo por ítem.
   *
   * @param requiredItemId - Identificador exacto del ítem requerido (ej. `'bronze_key'`).
   * @param requiredItemLabel - Nombre legible opcional para mensajes de retroalimentación.
   */
  constructor(requiredItemId: string, requiredItemLabel?: string) {
    const normalizedId = requiredItemId.trim();
    if (!normalizedId) {
      throw new Error('ItemUnlockStrategy requiere un requiredItemId no vacío.');
    }

    this.requiredItemId = normalizedId;
    this.requiredItemLabel = requiredItemLabel?.trim() || normalizedId;
  }

  /**
   * Devuelve el identificador del ítem necesario para resolver el acertijo.
   */
  public getRequiredItemId(): string {
    return this.requiredItemId;
  }

  /**
   * Devuelve la etiqueta legible del ítem necesario para mensajes de pista en pantalla.
   */
  public getRequiredItemLabel(): string {
    return this.requiredItemLabel;
  }

  /**
   * Evalúa si el `itemId` proporcionado coincide con el ítem requerido.
   *
   * @param input - Identificador del ítem seleccionado por el jugador.
   */
  public validate(input: PuzzleInput): ValidationResult {
    const providedId = Array.isArray(input)
      ? input.map((item) => String(item).trim()).join('')
      : String(input).trim();

    if (!providedId) {
      return {
        isValid: false,
        message: `Necesitas usar "${this.requiredItemLabel}" para desbloquear esto.`,
        progress: 0,
        shouldResetInput: false,
      };
    }

    if (providedId === this.requiredItemId) {
      return {
        isValid: true,
        message: `"${this.requiredItemLabel}" encaja perfectamente. ¡Acceso liberado!`,
        progress: 1,
        shouldResetInput: false,
      };
    }

    return {
      isValid: false,
      message: `El objeto seleccionado no funciona aquí. Se requiere "${this.requiredItemLabel}".`,
      progress: 0,
      shouldResetInput: false,
    };
  }

  /**
   * Restablece estado interno (estrategia sin estado parcial acumulable).
   */
  public reset(): void {
    // Sin estado acumulado interno que limpiar.
  }

  /**
   * Crea una copia independiente de la estrategia de desbloqueo por ítem.
   */
  public clone(): ItemUnlockStrategy {
    return new ItemUnlockStrategy(this.requiredItemId, this.requiredItemLabel);
  }
}
