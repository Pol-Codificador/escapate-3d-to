/**
 * @pattern MVC (Arquitectónico)
 * @role Controller
 *
 * Problema de diseño que resuelve:
 * Actúa como único intermediario entre la Vista (`SceneManager` + UI) y el Modelo
 * (`GameManager`, `Room`, `Inventory`, `GameTimer`). Traduce las acciones del jugador
 * en comandos concretos ejecutados mediante `CommandInvoker` (habilitando historial y
 * `undo()`) y gobierna el bucle principal `requestAnimationFrame`.
 */

import type { ValidationResult } from '../core/interfaces/IPuzzleValidationStrategy';
import type { ThemeType } from '../core/interfaces/IThemeFactory';
import { GameManager } from '../core/singletons/GameManager';
import type { InteractiveObject } from '../model/entities/InteractiveObject';
import type { Room } from '../model/entities/Room';
import type { SceneManager } from '../view/scene/SceneManager';
import { CommandInvoker } from './commands/CommandInvoker';
import { InputCodeCommand } from './commands/InputCodeCommand';
import {
  InspectObjectCommand,
  type InspectionPayload,
} from './commands/InspectObjectCommand';
import { PickUpItemCommand } from './commands/PickUpItemCommand';
import { ToggleSwitchCommand } from './commands/ToggleSwitchCommand';
import { UseItemCommand } from './commands/UseItemCommand';

export type InspectionListener = (payload: InspectionPayload) => void;
export type HoveredObjectListener = (object: InteractiveObject | null) => void;
export type FeedbackListener = (message: string) => void;

/**
 * Controlador principal MVC del Escape Room.
 */
export class GameController {
  private readonly gameManager: GameManager;
  private readonly sceneManager: SceneManager;
  private readonly commandInvoker: CommandInvoker;

  private readonly inspectionListeners: Set<InspectionListener>;
  private readonly hoveredObjectListeners: Set<HoveredObjectListener>;
  private readonly feedbackListeners: Set<FeedbackListener>;

  private animationFrameId: number | null;
  private lastTimestampMs: number | null;
  private lastHoveredObjectId: string | null;

  /**
   * @param sceneManager - Instancia de la Vista 3D en Three.js.
   * @param gameManager - Singleton coordinador del Modelo (por defecto `GameManager.getInstance()`).
   */
  constructor(
    sceneManager: SceneManager,
    gameManager: GameManager = GameManager.getInstance()
  ) {
    this.sceneManager = sceneManager;
    this.gameManager = gameManager;
    this.commandInvoker = new CommandInvoker();

    this.inspectionListeners = new Set<InspectionListener>();
    this.hoveredObjectListeners = new Set<HoveredObjectListener>();
    this.feedbackListeners = new Set<FeedbackListener>();

    this.animationFrameId = null;
    this.lastTimestampMs = null;
    this.lastHoveredObjectId = null;
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

  public getCurrentRoom(): Room | null {
    return this.gameManager.getCurrentRoom();
  }

  public getCurrentTheme(): ThemeType | null {
    return this.gameManager.getCurrentRoom()?.themeConfiguration.themeType ?? null;
  }

  /**
   * Inicia una nueva partida para la temática indicada y construye su escena 3D.
   */
  public startNewGame(theme: ThemeType): Room {
    this.commandInvoker.clear();
    const room = this.gameManager.startGame(theme);
    this.sceneManager.buildRoomScene(room, this.gameManager.getTimer());
    this.lastHoveredObjectId = null;
    this.emitHoveredObject(null);
    this.emitFeedback(room.themeConfiguration.narrativeConfig.introText);
    return room;
  }

  /**
   * Reinicia la partida actual clonando `roomPrototype` (Patrón Prototype)
   * y reconstruye la escena 3D limpia.
   */
  public restartCurrentGame(): Room {
    this.commandInvoker.clear();
    const room = this.gameManager.restartGame();
    this.sceneManager.buildRoomScene(room, this.gameManager.getTimer());
    this.lastHoveredObjectId = null;
    this.emitHoveredObject(null);
    this.emitFeedback('Sala reiniciada desde el prototipo inicial.');
    return room;
  }

  /**
   * Despacha la interacción sobre un objeto apuntado hacia el comando correspondiente.
   */
  public handleObjectInteraction(objectId: string): void {
    const room = this.gameManager.getCurrentRoom();
    if (!room) {
      return;
    }

    const lifecycle = this.gameManager.getLifecycleState();
    if (lifecycle !== 'playing') {
      return;
    }

    const target = room.getObject(objectId);
    if (!target || !target.isVisible) {
      return;
    }

    if (target.kind === 'item_pickup') {
      const command = new PickUpItemCommand(
        room,
        this.gameManager.getInventory(),
        target.id
      );
      this.commandInvoker.executeCommand(command);
      const picked = command.getPickedItem();
      if (picked) {
        this.emitFeedback(`Recogiste: ${picked.name}.`);
      }
      return;
    }

    if (target.kind === 'exit_door' && !room.exitDoor.getIsOpen()) {
      const command = new UseItemCommand(room, this.gameManager.getInventory());
      this.commandInvoker.executeCommand(command);
      const result = command.getValidationResult();
      if (result) {
        this.emitFeedback(result.message);
      }
      return;
    }

    const inspectCommand = new InspectObjectCommand(
      room,
      target.id,
      (payload: InspectionPayload): void => {
        for (const listener of this.inspectionListeners) {
          listener(payload);
        }
        const previewText = payload.noteContent
          ? `${payload.title}: ${payload.noteContent.replace(/\n+/g, ' ')}`
          : `${payload.title} — ${payload.message}`;
        this.emitFeedback(previewText);
      }
    );
    this.commandInvoker.executeCommand(inspectCommand);
  }

  /**
   * Envía un símbolo de interruptor (`'A' | 'B' | 'C'`) al Acertijo 1 vía `ToggleSwitchCommand`.
   */
  public submitSwitch(symbol: string): ValidationResult | null {
    const room = this.gameManager.getCurrentRoom();
    if (!room || this.gameManager.getLifecycleState() !== 'playing') {
      return null;
    }

    const puzzle = room.getPuzzle('sequence_puzzle');
    if (!puzzle) {
      return null;
    }

    const command = new ToggleSwitchCommand(puzzle, symbol);
    this.commandInvoker.executeCommand(command);
    const result = command.getValidationResult();
    if (result) {
      this.emitFeedback(result.message);
    }
    return result;
  }

  /**
   * Envía un código PIN de 4 dígitos al Acertijo 2 vía `InputCodeCommand`.
   */
  public submitPinCode(pin: string): ValidationResult | null {
    const room = this.gameManager.getCurrentRoom();
    if (!room || this.gameManager.getLifecycleState() !== 'playing') {
      return null;
    }

    const puzzle = room.getPuzzle('pin_puzzle');
    if (!puzzle) {
      return null;
    }

    const command = new InputCodeCommand(puzzle, pin, room);
    this.commandInvoker.executeCommand(command);
    const result = command.getValidationResult();
    if (result) {
      this.emitFeedback(result.message);
    }
    return result;
  }

  /**
   * Revierte la última acción reversible del jugador (tecla `Z`) vía `CommandInvoker`.
   */
  public undoLastAction(): boolean {
    if (this.gameManager.getLifecycleState() !== 'playing') {
      return false;
    }

    const undone = this.commandInvoker.undoLast();
    this.emitFeedback(
      undone
        ? 'Última acción reversible deshecha (Z).'
        : 'No hay acciones reversibles para deshacer.'
    );
    return undone;
  }

  /**
   * Inicia el bucle principal `requestAnimationFrame` que coordina `GameTimer` y Vista 3D.
   */
  public startLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastTimestampMs = null;
    const step = (timestampMs: number): void => {
      const deltaSeconds =
        this.lastTimestampMs === null
          ? 0
          : Math.min(0.1, Math.max(0, (timestampMs - this.lastTimestampMs) / 1000));
      this.lastTimestampMs = timestampMs;

      if (this.gameManager.getLifecycleState() === 'playing') {
        this.gameManager.update(deltaSeconds);
      }

      const hovered = this.sceneManager.updateFrame(deltaSeconds);
      const hoveredId = hovered ? hovered.id : null;
      if (hoveredId !== this.lastHoveredObjectId) {
        this.lastHoveredObjectId = hoveredId;
        this.emitHoveredObject(hovered);
      }

      this.animationFrameId = window.requestAnimationFrame(step);
    };

    this.animationFrameId = window.requestAnimationFrame(step);
  }

  /**
   * Detiene el bucle principal `requestAnimationFrame`.
   */
  public stopLoop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTimestampMs = null;
  }

  public onObjectInspected(listener: InspectionListener): () => void {
    this.inspectionListeners.add(listener);
    return (): void => {
      this.inspectionListeners.delete(listener);
    };
  }

  public onHoveredObjectChange(listener: HoveredObjectListener): () => void {
    this.hoveredObjectListeners.add(listener);
    return (): void => {
      this.hoveredObjectListeners.delete(listener);
    };
  }

  public onFeedbackMessage(listener: FeedbackListener): () => void {
    this.feedbackListeners.add(listener);
    return (): void => {
      this.feedbackListeners.delete(listener);
    };
  }

  public dispose(): void {
    this.stopLoop();
    this.inspectionListeners.clear();
    this.hoveredObjectListeners.clear();
    this.feedbackListeners.clear();
    this.sceneManager.dispose();
  }

  private emitHoveredObject(object: InteractiveObject | null): void {
    for (const listener of this.hoveredObjectListeners) {
      listener(object);
    }
  }

  private emitFeedback(message: string): void {
    for (const listener of this.feedbackListeners) {
      listener(message);
    }
  }
}
