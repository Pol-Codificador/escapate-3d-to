/**
 * @pattern Command (GoF Comportamental) + Observer (GoF Comportamental)
 * @role Invoker & ConcreteSubject
 *
 * Problema de diseño que resuelve:
 * Centraliza la ejecución de cualquier `ICommand` desacoplando al Controlador de los
 * receptores concretos del Modelo, conserva un historial cronológico con marcas de tiempo,
 * permite revertir el último comando reversible (`undoLast()`) y notifica en tiempo real
 * a los observadores (HUD en Fase 3) cada vez que un comando se ejecuta, deshace o limpia.
 */

import type { ICommand } from '../../core/interfaces/ICommand';
import type { IObserver, ISubject } from '../../core/interfaces/IObserver';

/**
 * Extensión opcional de `ICommand` para consultar dinámicamente si la instancia
 * puede revertirse en el estado actual del Modelo.
 */
export interface UndoableCommand extends ICommand {
  canUndo?(): boolean;
}

/**
 * Tipos de eventos emitidos por `CommandInvoker` hacia sus observadores.
 */
export type CommandEventType = 'executed' | 'undone' | 'cleared';

/**
 * Registro cronológico inmutable de un comando ejecutado.
 */
export interface CommandHistoryEntry {
  readonly id: number;
  readonly command: ICommand;
  readonly commandName: string;
  readonly description: string;
  readonly timestamp: number;
  readonly formattedTime: string;
  readonly reversible: boolean;
  readonly undone: boolean;
}

/**
 * Instantánea observable del historial de comandos para HUD y depuración.
 */
export interface CommandHistorySnapshot {
  readonly entries: readonly CommandHistoryEntry[];
  readonly lastEntry: CommandHistoryEntry | null;
  readonly eventType: CommandEventType;
  readonly statusMessage: string;
}

/**
 * Invoker del patrón Command y ConcreteSubject del patrón Observer.
 */
export class CommandInvoker implements ISubject<CommandHistorySnapshot> {
  private entries: CommandHistoryEntry[];
  private observers: Set<IObserver<CommandHistorySnapshot>>;
  private nextEntryId: number;

  constructor() {
    this.entries = [];
    this.observers = new Set<IObserver<CommandHistorySnapshot>>();
    this.nextEntryId = 1;
  }

  /**
   * Ejecuta un comando, lo registra en el historial cronológico y notifica a los observadores.
   *
   * @param command - Comando concreto que implementa `ICommand`.
   */
  public executeCommand(command: ICommand): void {
    command.execute();

    const now = Date.now();
    const undoable = command as UndoableCommand;
    const reversible =
      typeof undoable.canUndo === 'function' ? undoable.canUndo() : false;

    const entry: CommandHistoryEntry = {
      id: this.nextEntryId,
      command,
      commandName: command.commandName ?? command.constructor.name,
      description: command.getDescription(),
      timestamp: now,
      formattedTime: this.formatTimestamp(now),
      reversible,
      undone: false,
    };
    this.nextEntryId += 1;

    this.entries.push(entry);
    this.notify(
      this.createSnapshot('executed', entry, `Acción ejecutada: ${entry.description}`)
    );
  }

  /**
   * Deshace el último comando reversible no revertido del historial.
   *
   * @returns `true` si se revirtió un comando; `false` si no había acciones reversibles.
   */
  public undoLast(): boolean {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const candidate = this.entries[index];
      if (candidate.undone) {
        continue;
      }

      const undoable = candidate.command as UndoableCommand;
      const canUndoNow =
        typeof undoable.canUndo === 'function'
          ? undoable.canUndo()
          : candidate.reversible;

      if (!canUndoNow) {
        continue;
      }

      candidate.command.undo();

      const updatedEntry: CommandHistoryEntry = {
        ...candidate,
        reversible: false,
        undone: true,
      };
      this.entries[index] = updatedEntry;

      this.notify(
        this.createSnapshot(
          'undone',
          updatedEntry,
          `Acción deshecha: ${updatedEntry.description}`
        )
      );
      return true;
    }

    return false;
  }

  /**
   * Devuelve una copia de solo lectura del historial cronológico de comandos.
   */
  public getHistory(): readonly CommandHistoryEntry[] {
    return this.entries.map((entry) => {
      if (entry.undone) {
        return { ...entry, reversible: false };
      }
      const undoable = entry.command as UndoableCommand;
      const reversible =
        typeof undoable.canUndo === 'function'
          ? undoable.canUndo()
          : entry.reversible;
      return { ...entry, reversible };
    });
  }

  /**
   * Limpia todo el historial de comandos (ej. al iniciar o reiniciar partida) y notifica.
   */
  public clear(): void {
    this.entries = [];
    this.nextEntryId = 1;
    this.notify(
      this.createSnapshot('cleared', null, 'Historial de comandos reiniciado.')
    );
  }

  public attach(observer: IObserver<CommandHistorySnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<CommandHistorySnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: CommandHistorySnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }

  private createSnapshot(
    eventType: CommandEventType,
    lastEntry: CommandHistoryEntry | null,
    statusMessage: string
  ): CommandHistorySnapshot {
    return {
      entries: this.getHistory(),
      lastEntry,
      eventType,
      statusMessage,
    };
  }

  private formatTimestamp(epochMs: number): string {
    const date = new Date(epochMs);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}
