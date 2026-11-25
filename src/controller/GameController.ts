/**
 * @pattern MVC (Arquitectónico) + Command (Client)
 * @role Controller
 *
 * Problema de diseño que resuelve:
 * Actúa como único intermediario de escritura entre la Vista (Escena 3D + UI) y el Modelo
 * (`GameManager`, `Room`, `Inventory`, `GameTimer`). Traduce cada intención del jugador en un
 * `ICommand` ejecutado vía `CommandInvoker` y gestiona el bucle principal `requestAnimationFrame`.
 */

import type { ThemeType } from '../core/interfaces/IThemeFactory';
import { AudioManager } from '../core/singletons/AudioManager';
import { GameManager } from '../core/singletons/GameManager';
import type { InteractiveObject } from '../model/entities/InteractiveObject';
import type { Room } from '../model/entities/Room';
import type { RaycastTargetHit } from '../view/scene/RaycastSelector';
import type { SceneManager } from '../view/scene/SceneManager';
import { CommandInvoker } from './commands/CommandInvoker';
import { InputCodeCommand } from './commands/InputCodeCommand';
import {
  InspectObjectCommand,
  type InspectionPayload,
} from './commands/InspectObjectCommand';
import { PickUpItemCommand } from './commands/PickUpItemCommand';
import {
  ToggleSwitchCommand,
  type SwitchSymbol,
} from './commands/ToggleSwitchCommand';
import { UseItemCommand } from './commands/UseItemCommand';

/**
 * Instantánea ligera emitida hacia la UI cuando cambia el objeto apuntado por el raycast.
 */
export interface HoverTargetInfo {
  readonly object: InteractiveObject;
  readonly switchSymbol?: SwitchSymbol;
  readonly distance: number;
}

/**
 * Controlador principal MVC encargado de orquestar comandos, partida y render loop.
 */
export class GameController {
  private readonly gameManager: GameManager;
  private readonly audioManager: AudioManager;
  private readonly sceneManager: SceneManager;
  private readonly commandInvoker: CommandInvoker;

  private animationFrameId: number | null;
  private lastFrameTimeMs: number | null;
  private lastHoverKey: string | null;

  private inspectionListener: ((payload: InspectionPayload) => void) | null;
  private hoverListener: ((hover: HoverTargetInfo | null) => void) | null;

  /**
   * @param sceneManager - Vista 3D encargada de construir y renderizar la sala.
   * @param gameManager - Singleton de ciclo de vida del Modelo (por defecto instancia única).
   */
  constructor(
    sceneManager: SceneManager,
    gameManager: GameManager = GameManager.getInstance()
  ) {
    this.sceneManager = sceneManager;
    this.gameManager = gameManager;
    this.audioManager = this.gameManager.getAudioManager();
    this.commandInvoker = new CommandInvoker();

    this.animationFrameId = null;
    this.lastFrameTimeMs = null;
    this.lastHoverKey = null;
    this.inspectionListener = null;
    this.hoverListener = null;

    this.sceneManager.bindTimer(this.gameManager.getTimer());
    this.gameManager.attach(this.sceneManager);
  }

  /**
   * Inicia una nueva partida con la temática elegida, limpia el historial de comandos
   * y construye la escena 3D correspondiente.
   */
  public startNewGame(theme: ThemeType): Room {
    this.audioManager.unlockAudio();
    this.commandInvoker.clear();

    const room = this.gameManager.startGame(theme);
    this.sceneManager.buildRoomScene(room);
    this.lastHoverKey = null;
    this.hoverListener?.(null);

    return room;
  }

  /**
   * Reinicia la partida actual clonando el prototipo de sala (`GameManager.restartGame()`)
   * y reconstruyendo la escena 3D limpia.
   */
  public restartCurrentGame(): Room {
    this.audioManager.unlockAudio();
    this.commandInvoker.clear();

    const room = this.gameManager.restartGame();
    this.sceneManager.buildRoomScene(room);
    this.lastHoverKey = null;
    this.hoverListener?.(null);

    return room;
  }

  /**
   * Traduce la interacción sobre un objeto 3D apuntado al comando concreto correspondiente.
   */
  public handleObjectInteraction(
    objectId: string,
    switchSymbol?: SwitchSymbol
  ): void {
    const room = this.gameManager.getCurrentRoom();
    if (!room || this.gameManager.getLifecycleState() !== 'playing') {
      return;
    }

    const target = room.getObject(objectId);
    if (!target || !target.isVisible) {
      return;
    }

    this.audioManager.unlockAudio();

    if (target.kind === 'switch_panel' && switchSymbol) {
      const seqPuzzle = room.getPuzzle(target.linkedPuzzleId ?? 'sequence_puzzle');
      if (seqPuzzle && !seqPuzzle.getIsSolved()) {
        this.submitSwitch(switchSymbol);
        return;
      }
    }

    if (target.kind === 'item_pickup' && !target.isLocked) {
      const pickCommand = new PickUpItemCommand(
        room,
        this.gameManager.getInventory(),
        target.id
      );
      this.commandInvoker.executeCommand(pickCommand);
      return;
    }

    if (target.kind === 'exit_door' && !room.exitDoor.getIsOpen()) {
      const useItemCommand = new UseItemCommand(
        room,
        this.gameManager.getInventory()
      );
      this.commandInvoker.executeCommand(useItemCommand);
      return;
    }

    const inspectCommand = new InspectObjectCommand(room, target.id, (payload) => {
      this.inspectionListener?.(payload);
    });
    this.commandInvoker.executeCommand(inspectCommand);
  }

  /**
   * Envía un interruptor (`'A' | 'B' | 'C'`) al Acertijo 1 mediante `ToggleSwitchCommand`.
   */
  public submitSwitch(symbol: string): void {
    const room = this.gameManager.getCurrentRoom();
    if (!room || this.gameManager.getLifecycleState() !== 'playing') {
      return;
    }

    const normalized = symbol.trim().toUpperCase();
    if (normalized !== 'A' && normalized !== 'B' && normalized !== 'C') {
      return;
    }

    const puzzle = room.getPuzzle('sequence_puzzle');
    if (!puzzle) {
      return;
    }

    this.audioManager.unlockAudio();
    const command = new ToggleSwitchCommand(puzzle, normalized);
    this.commandInvoker.executeCommand(command);
  }

  /**
   * Envía un código PIN de 4 dígitos al Acertijo 2 mediante `InputCodeCommand`.
   */
  public submitPinCode(pin: string): void {
    const room = this.gameManager.getCurrentRoom();
    if (!room || this.gameManager.getLifecycleState() !== 'playing') {
      return;
    }

    const puzzle = room.getPuzzle('pin_puzzle');
    if (!puzzle) {
      return;
    }

    this.audioManager.unlockAudio();
    const command = new InputCodeCommand(puzzle, pin, room);
    this.commandInvoker.executeCommand(command);
  }

  /**
   * Deshace la última acción reversible del jugador (tecla `Z`).
   */
  public undoLastAction(): boolean {
    if (this.gameManager.getLifecycleState() !== 'playing') {
      return false;
    }

    this.audioManager.unlockAudio();
    return this.commandInvoker.undoLast();
  }

  /**
   * Registra un listener para respuestas de inspección (notas, modales en Fase 3, pistas).
   */
  public setInspectionListener(
    listener: ((payload: InspectionPayload) => void) | null
  ): void {
    this.inspectionListener = listener;
  }

  /**
   * Registra un listener para actualizar el prompt del objeto apuntado por el raycaster.
   */
  public setHoverListener(
    listener: ((hover: HoverTargetInfo | null) => void) | null
  ): void {
    this.hoverListener = listener;
  }

  public getCommandInvoker(): CommandInvoker {
    return this.commandInvoker;
  }

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  public getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  /**
   * Inicia el bucle principal `requestAnimationFrame` para tiempo, física FPS y render 3D.
   */
  public startLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastFrameTimeMs = null;
    const tickFrame = (timestampMs: number): void => {
      const previousMs = this.lastFrameTimeMs ?? timestampMs;
      const rawDelta = Math.max(0, (timestampMs - previousMs) / 1000);
      const deltaSeconds = Math.min(rawDelta, 0.1);
      this.lastFrameTimeMs = timestampMs;

      if (this.gameManager.getLifecycleState() === 'playing') {
        this.gameManager.getTimer().tick(deltaSeconds);
      }

      const hit = this.sceneManager.renderFrame(deltaSeconds);
      this.emitHoverIfChanged(hit);

      this.animationFrameId = window.requestAnimationFrame(tickFrame);
    };

    this.animationFrameId = window.requestAnimationFrame(tickFrame);
  }

  /**
   * Detiene el bucle principal y desuscribe observadores de la escena.
   */
  public stopLoop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastFrameTimeMs = null;
  }

  public dispose(): void {
    this.stopLoop();
    this.gameManager.detach(this.sceneManager);
    this.sceneManager.dispose();
  }

  private emitHoverIfChanged(hit: RaycastTargetHit | null): void {
    if (!this.hoverListener) {
      return;
    }

    const nextKey = hit
      ? `${hit.objectId}:${hit.switchSymbol ?? ''}`
      : null;

    if (nextKey === this.lastHoverKey) {
      return;
    }
    this.lastHoverKey = nextKey;

    if (!hit) {
      this.hoverListener(null);
      return;
    }

    const room = this.gameManager.getCurrentRoom();
    const obj = room?.getObject(hit.objectId);
    if (!obj) {
      this.hoverListener(null);
      return;
    }

    this.hoverListener({
      object: obj,
      switchSymbol: hit.switchSymbol,
      distance: hit.distance,
    });
  }
}
