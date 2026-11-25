/**
 * @pattern Observer (GoF Comportamental) + Prototype (GoF Creacional)
 * @role ConcreteSubject & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Administra los ítems recolectados por el jugador en memoria pura y notifica
 * automáticamente a la Vista (HUD de inventario rápido 1–5) y al AudioManager
 * cada vez que se agrega, remueve, selecciona o limpia el inventario.
 */

import type { IObserver, ISubject } from '../../core/interfaces/IObserver';
import type { IPrototype } from '../../core/interfaces/IPrototype';
import { InventoryItem } from './InventoryItem';

/**
 * Tipo de cambio emitido por el inventario hacia sus observadores.
 */
export type InventoryEventType =
  | 'item_added'
  | 'item_removed'
  | 'item_selected'
  | 'cleared';

/**
 * Instantánea inmutable del inventario enviada en cada notificación Observer.
 */
export interface InventorySnapshot {
  readonly items: readonly InventoryItem[];
  readonly maxSlots: number;
  readonly selectedSlotIndex: number;
  readonly selectedItem: InventoryItem | null;
  readonly lastChangedItem: InventoryItem | null;
  readonly eventType: InventoryEventType;
}

/**
 * Inventario observable del jugador con capacidad fija de ranuras rápidas.
 */
export class Inventory
  implements ISubject<InventorySnapshot>, IPrototype<Inventory>
{
  private readonly maxSlots: number;
  private items: InventoryItem[];
  private selectedSlotIndex: number;
  private observers: Set<IObserver<InventorySnapshot>>;

  /**
   * Crea un inventario con capacidad configurable (5 ranuras por defecto).
   *
   * @param maxSlots - Número máximo de ítems simultáneos.
   * @param initialItems - Ítems iniciales opcionales (usado al clonar).
   * @param selectedSlotIndex - Índice de ranura inicialmente seleccionada.
   */
  constructor(
    maxSlots = 5,
    initialItems: readonly InventoryItem[] = [],
    selectedSlotIndex = 0
  ) {
    this.maxSlots = Math.max(1, maxSlots);
    this.items = initialItems.slice(0, this.maxSlots).map((item) => item.clone());
    this.selectedSlotIndex =
      selectedSlotIndex >= 0 && selectedSlotIndex < this.maxSlots
        ? selectedSlotIndex
        : 0;
    this.observers = new Set<IObserver<InventorySnapshot>>();
  }

  /**
   * Agrega un ítem al inventario si hay espacio y no está duplicado.
   *
   * @returns `true` si se agregó correctamente, `false` si estaba lleno o repetido.
   */
  public addItem(item: InventoryItem): boolean {
    if (this.hasItem(item.id) || this.items.length >= this.maxSlots) {
      return false;
    }

    this.items.push(item);
    this.selectedSlotIndex = this.items.length - 1;
    this.notify(this.createSnapshot('item_added', item));
    return true;
  }

  /**
   * Remueve un ítem por su identificador y notifica el cambio.
   *
   * @returns El ítem removido o `undefined` si no existía.
   */
  public removeItem(itemId: string): InventoryItem | undefined {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return undefined;
    }

    const [removedItem] = this.items.splice(index, 1);
    if (this.selectedSlotIndex >= this.items.length) {
      this.selectedSlotIndex = Math.max(0, this.items.length - 1);
    }

    this.notify(this.createSnapshot('item_removed', removedItem));
    return removedItem;
  }

  /**
   * Verifica si un ítem específico está actualmente en el inventario.
   */
  public hasItem(itemId: string): boolean {
    return this.items.some((item) => item.id === itemId);
  }

  /**
   * Obtiene un ítem por su identificador sin removerlo.
   */
  public getItem(itemId: string): InventoryItem | undefined {
    return this.items.find((item) => item.id === itemId);
  }

  /**
   * Devuelve una copia de solo lectura de los ítems almacenados.
   */
  public getItems(): readonly InventoryItem[] {
    return [...this.items];
  }

  public getMaxSlots(): number {
    return this.maxSlots;
  }

  /**
   * Selecciona una ranura rápida (0..maxSlots-1) y notifica a los observadores.
   */
  public selectSlot(index: number): boolean {
    if (index < 0 || index >= this.maxSlots) {
      return false;
    }

    this.selectedSlotIndex = index;
    const selected = this.getSelectedItem();
    this.notify(this.createSnapshot('item_selected', selected));
    return true;
  }

  /**
   * Selecciona la ranura que contiene un ítem dado por `itemId`.
   */
  public selectItem(itemId: string): boolean {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return false;
    }
    return this.selectSlot(index);
  }

  public getSelectedSlotIndex(): number {
    return this.selectedSlotIndex;
  }

  /**
   * Devuelve el ítem actualmente seleccionado en la ranura activa, o `null`.
   */
  public getSelectedItem(): InventoryItem | null {
    return this.items[this.selectedSlotIndex] ?? null;
  }

  /**
   * Vacía completamente el inventario y notifica a los observadores.
   */
  public clear(): void {
    this.items = [];
    this.selectedSlotIndex = 0;
    this.notify(this.createSnapshot('cleared', null));
  }

  public getSnapshot(eventType: InventoryEventType = 'item_selected'): InventorySnapshot {
    return this.createSnapshot(eventType, this.getSelectedItem());
  }

  public attach(observer: IObserver<InventorySnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<InventorySnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: InventorySnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }

  /**
   * Clona profundamente el inventario y cada uno de sus ítems, sin copiar observadores.
   */
  public clone(): Inventory {
    return new Inventory(this.maxSlots, this.items, this.selectedSlotIndex);
  }

  private createSnapshot(
    eventType: InventoryEventType,
    lastChangedItem: InventoryItem | null
  ): InventorySnapshot {
    return {
      items: [...this.items],
      maxSlots: this.maxSlots,
      selectedSlotIndex: this.selectedSlotIndex,
      selectedItem: this.getSelectedItem(),
      lastChangedItem,
      eventType,
    };
  }
}
