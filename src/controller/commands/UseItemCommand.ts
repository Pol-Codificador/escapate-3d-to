/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula la acción de aplicar un ítem del `Inventory` sobre `ExitDoor`
 * (Acertijo 3 `ItemUnlockStrategy`), validando el desbloqueo final y consumiendo
 * la llave/tarjeta sin acoplar la Vista al inventario ni a las reglas de salida.
 */

import type { ValidationResult } from '../../core/interfaces/IPuzzleValidationStrategy';
import type { Inventory } from '../../model/entities/Inventory';
import type { Room } from '../../model/entities/Room';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Comando concreto para usar un ítem del inventario sobre la puerta de salida.
 */
export class UseItemCommand implements UndoableCommand {
  private readonly room: Room;
  private readonly inventory: Inventory;
  private readonly explicitItemId?: string;

  private usedItemName: string | null;
  private succeeded: boolean;
  private lastResult: ValidationResult | null;

  /**
   * @param room - Sala activa que contiene `exitDoor` y su acertijo asociado.
   * @param inventory - Inventario del jugador donde se consulta el ítem seleccionado.
   * @param explicitItemId - ID opcional de ítem específico; si se omite usa el ítem seleccionado.
   */
  constructor(room: Room, inventory: Inventory, explicitItemId?: string) {
    this.room = room;
    this.inventory = inventory;
    this.explicitItemId = explicitItemId;
    this.usedItemName = null;
    this.succeeded = false;
    this.lastResult = null;
  }

  public execute(): void {
    const exitPuzzleId = this.room.exitDoor.linkedPuzzleId ?? 'exit_puzzle';
    const exitPuzzle = this.room.getPuzzle(exitPuzzleId);
    if (!exitPuzzle) {
      return;
    }

    const item = this.explicitItemId
      ? this.inventory.getItem(this.explicitItemId) ?? null
      : this.inventory.getSelectedItem();

    this.usedItemName = item ? item.name : null;

    const result = exitPuzzle.attempt(item ? item.id : '');
    this.lastResult = result;
    this.succeeded = result.isValid;

    if (result.isValid && item) {
      this.inventory.removeItem(item.id);
      return;
    }

    if (!result.isValid) {
      this.room.setStatus(this.room.getStatus(), result.message);
    }
  }

  public canUndo(): boolean {
    return false;
  }

  public undo(): void {
    // Abrir la puerta de salida finaliza la partida y no es reversible.
  }

  public getValidationResult(): ValidationResult | null {
    return this.lastResult;
  }

  public getDescription(): string {
    if (!this.usedItemName) {
      return `Intentó abrir "${this.room.exitDoor.name}" sin ítem equipado`;
    }

    return this.succeeded
      ? `Usó "${this.usedItemName}" en "${this.room.exitDoor.name}"`
      : `Probó "${this.usedItemName}" en "${this.room.exitDoor.name}" sin éxito`;
  }
}
