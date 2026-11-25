/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula la recolección de un ítem desde un objeto `item_pickup` de la sala hacia
 * el `Inventory` del jugador, ocultándolo en la sala y permitiendo revertirlo (`undo()`)
 * devolviendo el ítem al mismo punto si aún no fue consumido.
 */

import type { Inventory } from '../../model/entities/Inventory';
import type { InventoryItem } from '../../model/entities/InventoryItem';
import type { Room } from '../../model/entities/Room';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Comando concreto reversible para recoger `bronze_key` o `access_card_lv5`.
 */
export class PickUpItemCommand implements UndoableCommand {
  public readonly commandName = 'PickUpItemCommand';

  private readonly room: Room;
  private readonly inventory: Inventory;
  private readonly objectId: string;

  private pickedItem: InventoryItem | null;
  private undone: boolean;

  /**
   * @param room - Sala activa que contiene el objeto recolectable.
   * @param inventory - Inventario observable del `GameManager`.
   * @param objectId - ID del objeto `item_pickup` en la sala (`'reward_item_pickup'`).
   */
  constructor(
    room: Room,
    inventory: Inventory,
    objectId = 'reward_item_pickup'
  ) {
    this.room = room;
    this.inventory = inventory;
    this.objectId = objectId;
    this.pickedItem = null;
    this.undone = false;
  }

  public execute(): void {
    const target = this.room.getObject(this.objectId);
    if (!target || target.kind !== 'item_pickup' || !target.isVisible || target.isLocked) {
      return;
    }

    const item = target.consumeRewardItem();
    if (!item) {
      return;
    }

    const added = this.inventory.addItem(item);
    if (!added) {
      target.restoreRewardItem(item);
      this.room.setStatus(
        this.room.getStatus(),
        'Tu inventario está lleno o ya contiene este objeto.'
      );
      return;
    }

    target.setVisible(false);
    target.deactivate();
    this.pickedItem = item;
    this.undone = false;

    this.room.setStatus(
      this.room.getStatus(),
      `Recogiste "${item.name}" y lo guardaste en el inventario.`
    );
  }

  public canUndo(): boolean {
    if (!this.pickedItem || this.undone) {
      return false;
    }

    if (this.room.getStatus() !== 'in_progress') {
      return false;
    }

    return this.inventory.hasItem(this.pickedItem.id);
  }

  public undo(): void {
    if (!this.canUndo() || !this.pickedItem) {
      return;
    }

    const removed = this.inventory.removeItem(this.pickedItem.id);
    if (!removed) {
      return;
    }

    const target = this.room.getObject(this.objectId);
    if (target) {
      target.restoreRewardItem(removed);
      target.unlock();
      target.activate();
      target.setVisible(true);
    }

    this.undone = true;
    this.room.setStatus(
      this.room.getStatus(),
      `Devolviste "${removed.name}" a su pedestal.`
    );
  }

  public getPickedItem(): InventoryItem | null {
    return this.pickedItem;
  }

  public getDescription(): string {
    return this.pickedItem
      ? `Recogió "${this.pickedItem.name}"`
      : `Intentó recoger objeto (${this.objectId})`;
  }
}
