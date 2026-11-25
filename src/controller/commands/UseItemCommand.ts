/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula la acción de aplicar un ítem del `Inventory` sobre cualquier objeto
 * desbloqueable por ítem (`desk_box` o `exit_door`, reutilizando `ItemUnlockStrategy`),
 * validando el desbloqueo y consumiendo el ítem sin acoplar la Vista al inventario.
 */

import type { ValidationResult } from '../../core/interfaces/IPuzzleValidationStrategy';
import type { Inventory } from '../../model/entities/Inventory';
import type { InventoryItem } from '../../model/entities/InventoryItem';
import type { Room } from '../../model/entities/Room';
import { ItemUnlockStrategy } from '../../model/puzzles/strategies/ItemUnlockStrategy';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Comando concreto para usar un ítem del inventario sobre `desk_box` o `exit_door`.
 */
export class UseItemCommand implements UndoableCommand {
  public readonly commandName = 'UseItemCommand';

  private readonly room: Room;
  private readonly inventory: Inventory;
  private readonly targetObjectId: string;
  private readonly explicitItemId?: string;

  private targetObjectName: string;
  private usedItemName: string | null;
  private succeeded: boolean;
  private lastResult: ValidationResult | null;

  /**
   * @param room - Sala activa que contiene el objeto objetivo y su acertijo asociado.
   * @param inventory - Inventario del jugador donde se consulta el ítem equipado.
   * @param targetObjectId - ID del objeto objetivo (`'desk_box'` o `'exit_door'`).
   * @param explicitItemId - ID opcional de ítem específico; si se omite usa la ranura activa o compatible.
   */
  constructor(
    room: Room,
    inventory: Inventory,
    targetObjectId = 'exit_door',
    explicitItemId?: string
  ) {
    this.room = room;
    this.inventory = inventory;
    this.targetObjectId = targetObjectId;
    this.explicitItemId = explicitItemId;
    this.targetObjectName = room.getObject(targetObjectId)?.name ?? room.exitDoor.name;
    this.usedItemName = null;
    this.succeeded = false;
    this.lastResult = null;
  }

  public execute(): void {
    const target = this.room.getObject(this.targetObjectId);
    if (!target) {
      return;
    }
    this.targetObjectName = target.name;

    const puzzleId = target.linkedPuzzleId ?? 'exit_puzzle';
    const puzzle = this.room.getPuzzle(puzzleId);
    if (!puzzle) {
      return;
    }

    const item = this.resolveItemToUse(puzzle.getStrategy());
    this.usedItemName = item ? item.name : null;

    const result = puzzle.attempt(item ? item.id : '');
    this.lastResult = result;
    this.succeeded = result.isValid;

    if (result.isValid && item) {
      this.inventory.removeItem(item.id);
      if (target.id !== this.room.exitDoor.id) {
        this.room.setStatus(
          this.room.getStatus(),
          `${target.name} desbloqueado con "${item.name}".`
        );
      }
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
    // Desbloquear una cerradura física con consumo de ítem no es reversible.
  }

  public getValidationResult(): ValidationResult | null {
    return this.lastResult;
  }

  public getDescription(): string {
    if (!this.usedItemName) {
      return `Intentó abrir "${this.targetObjectName}" sin ítem equipado`;
    }

    return this.succeeded
      ? `Usó "${this.usedItemName}" en "${this.targetObjectName}"`
      : `Probó "${this.usedItemName}" en "${this.targetObjectName}" sin éxito`;
  }

  private resolveItemToUse(
    strategy: ReturnType<NonNullable<ReturnType<Room['getPuzzle']>>['getStrategy']>
  ): InventoryItem | null {
    if (this.explicitItemId) {
      return this.inventory.getItem(this.explicitItemId) ?? null;
    }

    const selected = this.inventory.getSelectedItem();
    if (selected) {
      if (
        strategy instanceof ItemUnlockStrategy &&
        selected.id !== strategy.getRequiredItemId() &&
        this.inventory.hasItem(strategy.getRequiredItemId())
      ) {
        return this.inventory.getItem(strategy.getRequiredItemId()) ?? selected;
      }
      return selected;
    }

    if (strategy instanceof ItemUnlockStrategy) {
      return this.inventory.getItem(strategy.getRequiredItemId()) ?? null;
    }

    return null;
  }
}
