/**
 * @pattern Prototype (GoF Creacional)
 * @role ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Modela un ítem coleccionable puro del inventario (llave, tarjeta, nota o artefacto)
 * sin dependencias visuales ni de Three.js, y permite clonarlo de forma segura al
 * restaurar el estado inicial de una sala.
 */

import type { IPrototype } from '../../core/interfaces/IPrototype';
import type { ThemeItemIconType } from '../../core/interfaces/IThemeFactory';

/**
 * Propiedades iniciales para construir un ítem del inventario.
 */
export interface InventoryItemProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly iconType: ThemeItemIconType;
}

/**
 * Entidad pura que representa un objeto coleccionable dentro del inventario del jugador.
 */
export class InventoryItem implements IPrototype<InventoryItem> {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly iconType: ThemeItemIconType;

  /**
   * Crea un ítem coleccionable del inventario.
   *
   * @param props - Metadatos inmutables del ítem.
   */
  constructor(props: InventoryItemProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.iconType = props.iconType;
  }

  /**
   * Devuelve una copia independiente del ítem conservando todos sus atributos.
   */
  public clone(): InventoryItem {
    return new InventoryItem({
      id: this.id,
      name: this.name,
      description: this.description,
      iconType: this.iconType,
    });
  }
}
