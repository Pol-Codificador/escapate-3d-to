/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula el envío de un código PIN de 4 dígitos hacia el Acertijo 2 (`PinCodeStrategy`),
 * desacoplando el teclado numérico de la Vista de las reglas de validación del Modelo.
 */

import type { ValidationResult } from '../../core/interfaces/IPuzzleValidationStrategy';
import type { Room } from '../../model/entities/Room';
import type { Puzzle } from '../../model/puzzles/Puzzle';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Comando concreto para validar una combinación de 4 dígitos en `PinCodeStrategy`.
 */
export class InputCodeCommand implements UndoableCommand {
  public readonly commandName = 'InputCodeCommand';

  private readonly puzzle: Puzzle;
  private readonly pinCode: string;
  private readonly room?: Room;
  private accepted: boolean;
  private lastResult: ValidationResult | null;

  /**
   * @param puzzle - Entidad `Puzzle` vinculada a la caja fuerte o terminal (`pin_puzzle`).
   * @param pinCode - Código de 4 dígitos ingresado por el jugador.
   * @param room - Sala opcional para reflejar mensajes de fallo en el estado observable.
   */
  constructor(puzzle: Puzzle, pinCode: string, room?: Room) {
    this.puzzle = puzzle;
    this.pinCode = pinCode.trim();
    this.room = room;
    this.accepted = false;
    this.lastResult = null;
  }

  public execute(): void {
    const result = this.puzzle.attempt(this.pinCode);
    this.lastResult = result;
    this.accepted = result.isValid;

    if (!result.isValid && this.room) {
      this.room.setStatus(this.room.getStatus(), result.message);
    }
  }

  public canUndo(): boolean {
    return false;
  }

  public undo(): void {
    // Validar un PIN contra la caja fuerte no es una operación reversible.
  }

  public getValidationResult(): ValidationResult | null {
    return this.lastResult;
  }

  public getDescription(): string {
    const statusLabel = this.accepted ? 'aceptado' : 'denegado';
    return `Ingresó PIN "${this.pinCode}" (${statusLabel})`;
  }
}
