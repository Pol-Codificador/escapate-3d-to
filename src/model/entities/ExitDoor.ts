/**
 * @pattern Observer (GoF Comportamental) + Prototype (GoF Creacional)
 * @role ConcreteObserver & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Desacopla la puerta de salida del acertijo final: `ExitDoor` observa el estado
 * de su `Puzzle` asociado y se desbloquea/abre automáticamente en cuanto el acertijo
 * se resuelve, sin que `Puzzle` conozca la existencia de la puerta.
 */

import type { IObserver } from '../../core/interfaces/IObserver';
import type { IPrototype } from '../../core/interfaces/IPrototype';
import type { PuzzleSnapshot } from '../puzzles/Puzzle';
import {
  InteractiveObject,
  type InteractiveObjectProps,
} from './InteractiveObject';

/**
 * Propiedades específicas para crear la puerta de salida de una sala.
 */
export interface ExitDoorProps extends Omit<InteractiveObjectProps, 'kind'> {
  readonly unlockedPrompt?: string;
  readonly unlockedDescription?: string;
}

/**
 * Puerta de salida observable que reacciona automáticamente a la resolución de su acertijo.
 */
export class ExitDoor
  extends InteractiveObject
  implements IObserver<PuzzleSnapshot>, IPrototype<ExitDoor>
{
  private readonly lockedPrompt: string;
  private readonly lockedDescription: string;
  private readonly unlockedPrompt: string;
  private readonly unlockedDescription: string;
  private isOpenState: boolean;

  /**
   * Construye la puerta de salida vinculada a un acertijo.
   *
   * @param props - Propiedades espaciales, textos y `linkedPuzzleId`.
   */
  constructor(props: ExitDoorProps) {
    super({
      ...props,
      kind: 'exit_door',
    });

    this.lockedPrompt = props.interactionPrompt;
    this.lockedDescription = props.description;
    this.unlockedPrompt =
      props.unlockedPrompt ?? 'Puerta desbloqueada — Cruza para escapar';
    this.unlockedDescription =
      props.unlockedDescription ??
      'El mecanismo de cierre ha cedido. El camino hacia el exterior está libre.';
    this.isOpenState = !props.isLocked && props.isActivated;
  }

  /**
   * Indica si la puerta se encuentra abierta actualmente.
   */
  public getIsOpen(): boolean {
    return this.isOpenState;
  }

  /**
   * Reacciona a los cambios emitidos por el `Puzzle` asociado.
   *
   * @param snapshot - Instantánea actual del acertijo observado.
   */
  public update(snapshot: PuzzleSnapshot): void {
    if (this.linkedPuzzleId && snapshot.puzzleId !== this.linkedPuzzleId) {
      return;
    }

    if (snapshot.isSolved) {
      this.unlock();
      this.activate();
      this.isOpenState = true;
      this.setInteractionPrompt(this.unlockedPrompt);
      this.setDescription(this.unlockedDescription);
      return;
    }

    if (snapshot.eventType === 'reset') {
      this.lock();
      this.deactivate();
      this.isOpenState = false;
      this.setInteractionPrompt(this.lockedPrompt);
      this.setDescription(this.lockedDescription);
    }
  }

  /**
   * Clona profundamente la puerta de salida preservando su configuración original.
   */
  public override clone(): ExitDoor {
    const cloned = new ExitDoor({
      id: this.id,
      name: this.name,
      interactionPrompt: this.lockedPrompt,
      description: this.lockedDescription,
      unlockedPrompt: this.unlockedPrompt,
      unlockedDescription: this.unlockedDescription,
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

    if (!this.isLocked && this.isActivated) {
      cloned.unlock();
      cloned.activate();
      cloned.isOpenState = true;
      cloned.setInteractionPrompt(this.unlockedPrompt);
      cloned.setDescription(this.unlockedDescription);
    }

    return cloned;
  }
}
