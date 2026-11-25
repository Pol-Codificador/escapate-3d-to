/**
 * @pattern Builder (GoF Creacional)
 * @role Director
 *
 * Problema de diseño que resuelve:
 * Encapsula la secuencia exacta de pasos y distribución espacial (10 × 4 × 10 m,
 * sin superposiciones) para construir una sala completa de Escape Room a partir
 * de cualquier `IThemeFactory`, ocultando al resto del sistema cómo se ordenan los
 * acertijos encadenados, objetos interactivos y efectos de progresión.
 */

import type { IThemeFactory } from '../../core/interfaces/IThemeFactory';
import { ExitDoor } from '../entities/ExitDoor';
import { InteractiveObject } from '../entities/InteractiveObject';
import { InventoryItem } from '../entities/InventoryItem';
import type { Room } from '../entities/Room';
import { Puzzle } from '../puzzles/Puzzle';
import { RoomBuilder } from './RoomBuilder';

/**
 * Director encargado de orquestar `RoomBuilder` con una fábrica temática abstracta.
 */
export class RoomDirector {
  public static readonly DEFAULT_ROOM_WIDTH = 10;
  public static readonly DEFAULT_ROOM_HEIGHT = 4;
  public static readonly DEFAULT_ROOM_DEPTH = 10;
  public static readonly DEFAULT_TIME_LIMIT_SECONDS = 300;

  private readonly builder: RoomBuilder;

  /**
   * Crea un director reutilizando un `RoomBuilder` concreto o uno nuevo por defecto.
   *
   * @param builder - Instancia opcional de `RoomBuilder`.
   */
  constructor(builder: RoomBuilder = new RoomBuilder()) {
    this.builder = builder;
  }

  /**
   * Construye una sala jugable completa (10 × 4 × 10 m, 300 s) usando polimórficamente
   * cualquier fábrica que implemente `IThemeFactory`.
   *
   * Distribución espacial libre de superposiciones:
   * - Pared Norte (`z = -4.88`): `exit_door` centrado en `x = 0`.
   * - Sector Suroeste (`x = -3.2, z = 1.8`): `desk_note` (escritorio / consola con nota).
   * - Pared Oeste (`x = -4.85, z = -1.8`): `switch_panel` (interruptores A / B / C).
   * - Pared Este (`x = 4.85, z = -1.8`): `clue_wall` (cuadro UV / proyector holográfico).
   * - Sector Sureste (`x = 3.6, z = 1.9`): `safe` (caja fuerte / terminal criogénica).
   * - Pedestal junto a caja fuerte (`x = 3.6, z = 0.5`): `reward_item_pickup` (oculto hasta abrir).
   *
   * @param factory - Fábrica abstracta de la temática elegida (`HorrorThemeFactory` o `SciFiThemeFactory`).
   */
  public constructRoom(factory: IThemeFactory): Room {
    const colorPalette = factory.createColorPalette();
    const lightingConfig = factory.createLightingConfig();
    const narrativeConfig = factory.createNarrativeConfig();
    const audioConfig = factory.createAudioConfig();
    const catalog = factory.createGameplayCatalog();

    const sequencePuzzle = new Puzzle({
      id: catalog.sequencePuzzle.id,
      title: catalog.sequencePuzzle.title,
      description: catalog.sequencePuzzle.description,
      strategy: catalog.sequencePuzzle.strategy,
    });

    const pinPuzzle = new Puzzle({
      id: catalog.pinPuzzle.id,
      title: catalog.pinPuzzle.title,
      description: catalog.pinPuzzle.description,
      strategy: catalog.pinPuzzle.strategy,
    });

    const exitPuzzle = new Puzzle({
      id: catalog.exitPuzzle.id,
      title: catalog.exitPuzzle.title,
      description: catalog.exitPuzzle.description,
      strategy: catalog.exitPuzzle.strategy,
    });

    const rewardItem = new InventoryItem({
      id: catalog.rewardItem.id,
      name: catalog.rewardItem.name,
      description: catalog.rewardItem.description,
      iconType: catalog.rewardItem.iconType,
    });

    const deskNote = new InteractiveObject({
      id: 'desk_note',
      kind: 'note',
      name: catalog.objects.deskNote.name,
      interactionPrompt: catalog.objects.deskNote.interactionPrompt,
      description: catalog.objects.deskNote.description,
      position: { x: -3.2, y: 0, z: 1.8 },
      rotationY: Math.PI / 2,
      size: { width: 1.6, height: 0.85, depth: 0.9 },
      isLocked: false,
      isActivated: true,
      isVisible: true,
      noteContent: catalog.objects.deskNote.noteContent,
    });

    const switchPanel = new InteractiveObject({
      id: 'switch_panel',
      kind: 'switch_panel',
      name: catalog.objects.switchPanel.name,
      interactionPrompt: catalog.objects.switchPanel.interactionPrompt,
      description: catalog.objects.switchPanel.description,
      position: { x: -4.85, y: 1.45, z: -1.8 },
      rotationY: Math.PI / 2,
      size: { width: 0.75, height: 0.9, depth: 0.2 },
      isLocked: false,
      isActivated: false,
      isVisible: true,
      linkedPuzzleId: sequencePuzzle.getId(),
    });

    const clueWall = new InteractiveObject({
      id: 'clue_wall',
      kind: 'clue_wall',
      name: catalog.objects.clueWall.name,
      interactionPrompt: catalog.objects.clueWall.interactionPrompt,
      description: catalog.objects.clueWall.description,
      position: { x: 4.85, y: 1.65, z: -1.8 },
      rotationY: -Math.PI / 2,
      size: { width: 1.4, height: 1.0, depth: 0.16 },
      isLocked: true,
      isActivated: false,
      isVisible: true,
      linkedPuzzleId: sequencePuzzle.getId(),
      noteContent: catalog.objects.clueWall.noteContent,
    });

    const safeObject = new InteractiveObject({
      id: 'safe',
      kind: 'safe',
      name: catalog.objects.safe.name,
      interactionPrompt: catalog.objects.safe.interactionPrompt,
      description: catalog.objects.safe.description,
      position: { x: 3.6, y: 0, z: 1.9 },
      rotationY: -Math.PI / 2,
      size: { width: 0.95, height: 1.35, depth: 0.85 },
      isLocked: true,
      isActivated: false,
      isVisible: true,
      linkedPuzzleId: pinPuzzle.getId(),
    });

    const rewardPickup = new InteractiveObject({
      id: 'reward_item_pickup',
      kind: 'item_pickup',
      name: catalog.objects.rewardPickup.name,
      interactionPrompt: catalog.objects.rewardPickup.interactionPrompt,
      description: catalog.objects.rewardPickup.description,
      position: { x: 3.6, y: 0.95, z: 0.5 },
      rotationY: -Math.PI / 2,
      size: { width: 0.45, height: 0.35, depth: 0.45 },
      isLocked: true,
      isActivated: false,
      isVisible: false,
      linkedPuzzleId: pinPuzzle.getId(),
      rewardItem,
    });

    const exitDoor = new ExitDoor({
      id: 'exit_door',
      name: catalog.objects.exitDoor.name,
      interactionPrompt: catalog.objects.exitDoor.interactionPrompt,
      description: catalog.objects.exitDoor.description,
      unlockedPrompt: catalog.objects.exitDoor.activatedPrompt,
      unlockedDescription: catalog.objects.exitDoor.activatedDescription,
      position: { x: 0, y: 0, z: -4.88 },
      rotationY: 0,
      size: { width: 1.8, height: 2.8, depth: 0.24 },
      isLocked: true,
      isActivated: false,
      isVisible: true,
      linkedPuzzleId: exitPuzzle.getId(),
    });

    return this.builder
      .reset()
      .setDimensions(
        RoomDirector.DEFAULT_ROOM_WIDTH,
        RoomDirector.DEFAULT_ROOM_HEIGHT,
        RoomDirector.DEFAULT_ROOM_DEPTH
      )
      .setThemeConfiguration({
        themeType: factory.themeType,
        colorPalette,
        lightingConfig,
        narrativeConfig,
        audioConfig,
      })
      .setTimeLimit(RoomDirector.DEFAULT_TIME_LIMIT_SECONDS)
      .addPuzzle(sequencePuzzle)
      .addPuzzle(pinPuzzle)
      .addPuzzle(exitPuzzle)
      .addInteractiveObject(deskNote)
      .addInteractiveObject(switchPanel)
      .addInteractiveObject(clueWall)
      .addInteractiveObject(safeObject)
      .addInteractiveObject(rewardPickup)
      .setExitDoor(exitDoor)
      .addPuzzleSolvedEffect({
        puzzleId: sequencePuzzle.getId(),
        targetObjectId: 'switch_panel',
        activate: true,
        newPrompt: catalog.objects.switchPanel.activatedPrompt,
        newDescription: catalog.objects.switchPanel.activatedDescription,
      })
      .addPuzzleSolvedEffect({
        puzzleId: sequencePuzzle.getId(),
        targetObjectId: 'clue_wall',
        unlock: true,
        activate: true,
        newPrompt: catalog.objects.clueWall.activatedPrompt,
        newDescription: catalog.objects.clueWall.activatedDescription,
        newNoteContent: catalog.objects.clueWall.activatedNoteContent,
      })
      .addPuzzleSolvedEffect({
        puzzleId: pinPuzzle.getId(),
        targetObjectId: 'safe',
        unlock: true,
        activate: true,
        newPrompt: catalog.objects.safe.activatedPrompt,
        newDescription: catalog.objects.safe.activatedDescription,
      })
      .addPuzzleSolvedEffect({
        puzzleId: pinPuzzle.getId(),
        targetObjectId: 'reward_item_pickup',
        unlock: true,
        activate: true,
        setVisible: true,
      })
      .build();
  }
}
