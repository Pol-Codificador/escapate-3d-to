/**
 * @pattern Command (GoF Comportamental)
 * @role ConcreteCommand
 *
 * Problema de diseño que resuelve:
 * Encapsula la activación de un interruptor (`'A' | 'B' | 'C'`) sobre el Acertijo 1
 * (`SequenceStrategy`), permitiendo deshacer el último paso ingresado mediante `popStep()`
 * mientras el acertijo no haya sido resuelto ni reiniciado.
 */

import type { ValidationResult } from '../../core/interfaces/IPuzzleValidationStrategy';
import type { Puzzle } from '../../model/puzzles/Puzzle';
import { SequenceStrategy } from '../../model/puzzles/strategies/SequenceStrategy';
import type { UndoableCommand } from './CommandInvoker';

/**
 * Símbolos válidos de los interruptores del Acertijo 1.
 */
export type SwitchSymbol = 'A' | 'B' | 'C';

/**
 * Comando concreto que agrega un interruptor a `SequenceStrategy` y soporta `undo()`.
 */
export class ToggleSwitchCommand implements UndoableCommand {
  public readonly commandName = 'ToggleSwitchCommand';

  private readonly puzzle: Puzzle;
  private readonly switchSymbol: string;

  private executed: boolean;
  private undone: boolean;
  private wasResetOrSolved: boolean;
  private sequenceLengthAfterExecute: number;
  private outcomeMessage: string;
  private lastResult: ValidationResult | null;

  /**
   * @param puzzle - Entidad `Puzzle` vinculada al panel de interruptores (`sequence_puzzle`).
   * @param switchSymbol - Identificador del interruptor accionado (`'A' | 'B' | 'C'`).
   */
  constructor(puzzle: Puzzle, switchSymbol: SwitchSymbol | string) {
    this.puzzle = puzzle;
    this.switchSymbol = switchSymbol.trim().toUpperCase();
    this.executed = false;
    this.undone = false;
    this.wasResetOrSolved = false;
    this.sequenceLengthAfterExecute = 0;
    this.outcomeMessage = '';
    this.lastResult = null;
  }

  public execute(): void {
    const result = this.puzzle.attempt(this.switchSymbol);
    this.lastResult = result;
    this.executed = true;
    this.undone = false;
    this.outcomeMessage = result.message;

    const strategy = this.puzzle.getStrategy();
    if (strategy instanceof SequenceStrategy) {
      this.sequenceLengthAfterExecute = strategy.getCurrentSequence().length;
    } else {
      this.sequenceLengthAfterExecute = 0;
    }

    this.wasResetOrSolved = Boolean(result.shouldResetInput || result.isValid);
  }

  public canUndo(): boolean {
    if (!this.executed || this.undone || this.wasResetOrSolved || this.puzzle.getIsSolved()) {
      return false;
    }

    const strategy = this.puzzle.getStrategy();
    if (!(strategy instanceof SequenceStrategy)) {
      return false;
    }

    const currentSequence = strategy.getCurrentSequence();
    return (
      currentSequence.length === this.sequenceLengthAfterExecute &&
      currentSequence.length > 0 &&
      currentSequence[currentSequence.length - 1] === this.switchSymbol
    );
  }

  public undo(): void {
    if (!this.canUndo()) {
      return;
    }

    const strategy = this.puzzle.getStrategy();
    if (!(strategy instanceof SequenceStrategy)) {
      return;
    }

    const reverted = this.puzzle.undoLastStep();
    if (reverted) {
      this.undone = true;
    }
  }

  public getValidationResult(): ValidationResult | null {
    return this.lastResult;
  }

  public getDescription(): string {
    return this.outcomeMessage
      ? `Accionó interruptor ${this.switchSymbol} — ${this.outcomeMessage}`
      : `Accionó interruptor ${this.switchSymbol}`;
  }
}
