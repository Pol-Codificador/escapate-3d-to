/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula la acción de inspeccionar cualquier `InteractiveObject` por su ID
 * (leer nota/datapad, abrir panel de interruptores, abrir teclado de caja fuerte o
 * mostrar pista) sin acoplar al Controlador ni a la Vista con detalles internos del objeto.
 */

import { AudioManager } from '../../core/singletons/AudioManager';
import type { InteractiveObjectKind } from '../../model/entities/InteractiveObject';
import type { Room } from '../../model/entities/Room';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Tipo de respuesta UI/lógica que dispara la inspección de un objeto.
 */
export type InspectionResponseKind =
  | 'read_note'
  | 'open_switch_panel'
  | 'open_pin_keypad'
  | 'show_clue';

/**
 * Datos estructurados emitidos al inspeccionar un objeto de la sala.
 */
export interface InspectionPayload {
  readonly objectId: string;
  readonly objectName: string;
  readonly kind: InteractiveObjectKind;
  readonly responseKind: InspectionResponseKind;
  readonly title: string;
  readonly message: string;
  readonly noteContent?: string;
  readonly isLocked: boolean;
  readonly isActivated: boolean;
  readonly linkedPuzzleId?: string;
}

/**
 * Comando concreto para inspeccionar un `InteractiveObject` dentro de `Room`.
 */
export class InspectObjectCommand implements UndoableCommand {
  private readonly room: Room;
  private readonly objectId: string;
  private readonly onInspect?: (payload: InspectionPayload) => void;
  private inspectedObjectName: string;

  /**
   * @param room - Sala activa que actúa como receptor del dominio.
   * @param objectId - Identificador único del `InteractiveObject` a inspeccionar.
   * @param onInspect - Callback opcional para trasladar la respuesta de inspección hacia la Vista.
   */
  constructor(
    room: Room,
    objectId: string,
    onInspect?: (payload: InspectionPayload) => void
  ) {
    this.room = room;
    this.objectId = objectId;
    this.onInspect = onInspect;
    this.inspectedObjectName = objectId;
  }

  public execute(): void {
    const target = this.room.getObject(this.objectId);
    if (!target || !target.isVisible) {
      return;
    }

    this.inspectedObjectName = target.name;
    const responseKind = this.resolveResponseKind(target.kind, target.linkedPuzzleId, target.isActivated, target.noteContent);

    const summaryMessage =
      responseKind === 'read_note' && target.noteContent
        ? `${target.name}: ${this.condenseText(target.noteContent)}`
        : `${target.name}: ${target.description}`;

    AudioManager.getInstance().playClick();
    this.room.setStatus(this.room.getStatus(), summaryMessage);

    this.onInspect?.({
      objectId: target.id,
      objectName: target.name,
      kind: target.kind,
      responseKind,
      title: target.name,
      message: target.description,
      noteContent: target.noteContent,
      isLocked: target.isLocked,
      isActivated: target.isActivated,
      linkedPuzzleId: target.linkedPuzzleId,
    });
  }

  public canUndo(): boolean {
    return false;
  }

  public undo(): void {
    // La inspección es una acción de solo lectura; no modifica estado reversible.
  }

  public getDescription(): string {
    return `Inspeccionó "${this.inspectedObjectName}"`;
  }

  private resolveResponseKind(
    kind: InteractiveObjectKind,
    linkedPuzzleId: string | undefined,
    isActivated: boolean,
    noteContent: string | undefined
  ): InspectionResponseKind {
    const linkedPuzzle = linkedPuzzleId
      ? this.room.getPuzzle(linkedPuzzleId)
      : undefined;

    switch (kind) {
      case 'note':
        return 'read_note';
      case 'switch_panel':
        return linkedPuzzle && !linkedPuzzle.getIsSolved()
          ? 'open_switch_panel'
          : 'show_clue';
      case 'safe':
        return linkedPuzzle && !linkedPuzzle.getIsSolved()
          ? 'open_pin_keypad'
          : 'show_clue';
      case 'clue_wall':
        return isActivated && noteContent ? 'read_note' : 'show_clue';
      default:
        return 'show_clue';
    }
  }

  private condenseText(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim();
  }
}
