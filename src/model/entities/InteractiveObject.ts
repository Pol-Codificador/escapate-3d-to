/**
 * @pattern Prototype (GoF Creacional)
 * @role ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Modela cada elemento interactuable de la sala (nota, panel de interruptores,
 * pared de pista, caja fuerte/terminal, ítem recolectable o puerta) con sus datos
 * espaciales y estado lógico puros (sin meshes de Three.js), permitiendo clonar
 * toda la sala de forma profunda al reiniciar la partida.
 */

import type { IPrototype } from '../../core/interfaces/IPrototype';
import type { InventoryItem } from './InventoryItem';

/**
 * Tipos oficiales de elementos interactivos presentes en una sala del Escape Room.
 */
export type InteractiveObjectKind =
  | 'note'
  | 'switch_panel'
  | 'clue_wall'
  | 'safe'
  | 'item_pickup'
  | 'exit_door';

/**
 * Coordenadas espaciales puras en metros dentro de la sala 3D.
 */
export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Dimensiones puras (caja envolvente aproximada en metros) para colisión y render.
 */
export interface Dimensions3D {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

/**
 * Propiedades requeridas y opcionales para inicializar un `InteractiveObject`.
 */
export interface InteractiveObjectProps {
  readonly id: string;
  readonly kind: InteractiveObjectKind;
  readonly name: string;
  readonly interactionPrompt: string;
  readonly description: string;
  readonly position: Vector3D;
  readonly rotationY: number;
  readonly size: Dimensions3D;
  readonly isLocked: boolean;
  readonly isActivated: boolean;
  readonly isVisible: boolean;
  readonly linkedPuzzleId?: string;
  readonly rewardItem?: InventoryItem;
  readonly noteContent?: string;
}

/**
 * Entidad pura del Modelo que representa un objeto interactuable en la sala.
 */
export class InteractiveObject implements IPrototype<InteractiveObject> {
  public readonly id: string;
  public readonly kind: InteractiveObjectKind;
  public readonly name: string;
  public interactionPrompt: string;
  public description: string;
  public readonly position: Vector3D;
  public readonly rotationY: number;
  public readonly size: Dimensions3D;
  public isLocked: boolean;
  public isActivated: boolean;
  public isVisible: boolean;
  public readonly linkedPuzzleId?: string;
  public rewardItem?: InventoryItem;
  public noteContent?: string;

  /**
   * Construye un objeto interactivo con coordenadas, estado y metadatos puros.
   *
   * @param props - Definición inicial del objeto interactivo.
   */
  constructor(props: InteractiveObjectProps) {
    this.id = props.id;
    this.kind = props.kind;
    this.name = props.name;
    this.interactionPrompt = props.interactionPrompt;
    this.description = props.description;
    this.position = { ...props.position };
    this.rotationY = props.rotationY;
    this.size = { ...props.size };
    this.isLocked = props.isLocked;
    this.isActivated = props.isActivated;
    this.isVisible = props.isVisible;
    this.linkedPuzzleId = props.linkedPuzzleId;
    this.rewardItem = props.rewardItem?.clone();
    this.noteContent = props.noteContent;
  }

  public lock(): void {
    this.isLocked = true;
  }

  public unlock(): void {
    this.isLocked = false;
  }

  public activate(): void {
    this.isActivated = true;
  }

  public deactivate(): void {
    this.isActivated = false;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
  }

  public setInteractionPrompt(prompt: string): void {
    this.interactionPrompt = prompt;
  }

  public setDescription(description: string): void {
    this.description = description;
  }

  public setNoteContent(content: string): void {
    this.noteContent = content;
  }

  /**
   * Extrae y devuelve el ítem de recompensa contenido en este objeto (ej. al recogerlo),
   * dejando `rewardItem` en `undefined` para evitar duplicados.
   */
  public consumeRewardItem(): InventoryItem | undefined {
    const item = this.rewardItem;
    this.rewardItem = undefined;
    return item;
  }

  /**
   * Restaura un ítem de recompensa en el objeto (útil para revertir con `Command.undo()`).
   */
  public restoreRewardItem(item: InventoryItem): void {
    this.rewardItem = item;
  }

  /**
   * Clona profundamente el objeto interactivo, sus coordenadas, tamaño y `rewardItem`.
   */
  public clone(): InteractiveObject {
    return new InteractiveObject({
      id: this.id,
      kind: this.kind,
      name: this.name,
      interactionPrompt: this.interactionPrompt,
      description: this.description,
      position: { ...this.position },
      rotationY: this.rotationY,
      size: { ...this.size },
      isLocked: this.isLocked,
      isActivated: this.isActivated,
      isVisible: this.isVisible,
      linkedPuzzleId: this.linkedPuzzleId,
      rewardItem: this.rewardItem?.clone(),
      noteContent: this.noteContent,
    });
  }
}
