/**
 * @pattern Builder (Product) + Observer (Subject) + Prototype (GoF)
 * @role Product, ConcreteSubject & ConcretePrototype
 *
 * Problema de diseño que resuelve:
 * Centraliza el estado completo de una sala de escape (dimensiones, familia temática,
 * mapa de objetos interactivos, mapa de acertijos, puerta de salida y reglas de
 * encadenamiento). Su método `clone()` realiza una clonación profunda e independiente
 * y reconecta sus observadores internos para reiniciar partidas instantáneamente.
 */

import type { IObserver, ISubject } from '../../core/interfaces/IObserver';
import type { IPrototype } from '../../core/interfaces/IPrototype';
import type {
  ThemeAudioConfig,
  ThemeColorPalette,
  ThemeLightingConfig,
  ThemeNarrativeConfig,
  ThemeType,
} from '../../core/interfaces/IThemeFactory';
import { Puzzle, type PuzzleSnapshot } from '../puzzles/Puzzle';
import { ExitDoor } from './ExitDoor';
import type { InteractiveObject } from './InteractiveObject';

/**
 * Dimensiones físicas de la sala en metros.
 */
export interface RoomDimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

/**
 * Estado general de progreso dentro de la sala.
 */
export type RoomStatus = 'in_progress' | 'escaped' | 'failed';

/**
 * Configuración temática completa agrupada en la sala.
 */
export interface RoomThemeConfiguration {
  readonly themeType: ThemeType;
  readonly colorPalette: ThemeColorPalette;
  readonly lightingConfig: ThemeLightingConfig;
  readonly narrativeConfig: ThemeNarrativeConfig;
  readonly audioConfig: ThemeAudioConfig;
}

/**
 * Efecto declarativo que se aplica sobre un objeto de la sala cuando se resuelve un acertijo.
 */
export interface PuzzleSolvedEffect {
  readonly puzzleId: string;
  readonly targetObjectId: string;
  readonly unlock?: boolean;
  readonly activate?: boolean;
  readonly setVisible?: boolean;
  readonly newPrompt?: string;
  readonly newDescription?: string;
  readonly newNoteContent?: string;
}

/**
 * Instantánea observable del estado global de la sala.
 */
export interface RoomSnapshot {
  readonly themeType: ThemeType;
  readonly roomTitle: string;
  readonly status: RoomStatus;
  readonly solvedPuzzleIds: readonly string[];
  readonly totalPuzzles: number;
  readonly isExitOpen: boolean;
  readonly lastEventMessage: string;
}

/**
 * Parámetros completos para instanciar una `Room`.
 */
export interface RoomConfig {
  readonly dimensions: RoomDimensions;
  readonly themeConfiguration: RoomThemeConfiguration;
  readonly interactiveObjects: Map<string, InteractiveObject>;
  readonly puzzles: Map<string, Puzzle>;
  readonly exitDoor: ExitDoor;
  readonly timeLimitSeconds: number;
  readonly puzzleSolvedEffects: readonly PuzzleSolvedEffect[];
  readonly status?: RoomStatus;
}

/**
 * Producto construido por `RoomBuilder`: representa una sala completa del Escape Room.
 */
export class Room implements ISubject<RoomSnapshot>, IPrototype<Room> {
  public readonly dimensions: RoomDimensions;
  public readonly themeConfiguration: RoomThemeConfiguration;
  public readonly interactiveObjects: Map<string, InteractiveObject>;
  public readonly puzzles: Map<string, Puzzle>;
  public readonly exitDoor: ExitDoor;
  public readonly timeLimitSeconds: number;

  private readonly puzzleSolvedEffects: readonly PuzzleSolvedEffect[];
  private status: RoomStatus;
  private lastEventMessage: string;
  private observers: Set<IObserver<RoomSnapshot>>;
  private internalPuzzleObserver: IObserver<PuzzleSnapshot>;

  /**
   * Construye una sala completa y enlaza sus observadores internos entre acertijos y objetos.
   *
   * @param config - Estado y colecciones iniciales de la sala.
   */
  constructor(config: RoomConfig) {
    this.dimensions = { ...config.dimensions };
    this.themeConfiguration = {
      themeType: config.themeConfiguration.themeType,
      colorPalette: { ...config.themeConfiguration.colorPalette },
      lightingConfig: { ...config.themeConfiguration.lightingConfig },
      narrativeConfig: { ...config.themeConfiguration.narrativeConfig },
      audioConfig: { ...config.themeConfiguration.audioConfig },
    };
    this.interactiveObjects = new Map(config.interactiveObjects);
    this.puzzles = new Map(config.puzzles);
    this.exitDoor = config.exitDoor;
    this.timeLimitSeconds = config.timeLimitSeconds;
    this.puzzleSolvedEffects = config.puzzleSolvedEffects.map((effect) => ({ ...effect }));
    this.status = config.status ?? 'in_progress';
    this.lastEventMessage = config.themeConfiguration.narrativeConfig.introText;
    this.observers = new Set<IObserver<RoomSnapshot>>();

    // Garantiza que la puerta de salida siempre esté indexada en el mapa de objetos.
    this.interactiveObjects.set(this.exitDoor.id, this.exitDoor);

    this.internalPuzzleObserver = {
      update: (snapshot: PuzzleSnapshot): void => {
        this.handlePuzzleUpdate(snapshot);
      },
    };

    this.wireInternalObservers();
  }

  public getStatus(): RoomStatus {
    return this.status;
  }

  public setStatus(status: RoomStatus, message?: string): void {
    this.status = status;
    if (message) {
      this.lastEventMessage = message;
    }
    this.notify(this.getSnapshot());
  }

  public getObject(objectId: string): InteractiveObject | undefined {
    return this.interactiveObjects.get(objectId);
  }

  public getAllObjects(): readonly InteractiveObject[] {
    return Array.from(this.interactiveObjects.values());
  }

  public getPuzzle(puzzleId: string): Puzzle | undefined {
    return this.puzzles.get(puzzleId);
  }

  public getAllPuzzles(): readonly Puzzle[] {
    return Array.from(this.puzzles.values());
  }

  public getSolvedPuzzleIds(): readonly string[] {
    return this.getAllPuzzles()
      .filter((puzzle) => puzzle.getIsSolved())
      .map((puzzle) => puzzle.getId());
  }

  public getSnapshot(): RoomSnapshot {
    return {
      themeType: this.themeConfiguration.themeType,
      roomTitle: this.themeConfiguration.narrativeConfig.roomTitle,
      status: this.status,
      solvedPuzzleIds: this.getSolvedPuzzleIds(),
      totalPuzzles: this.puzzles.size,
      isExitOpen: this.exitDoor.getIsOpen(),
      lastEventMessage: this.lastEventMessage,
    };
  }

  /**
   * Conecta los observadores internos de la sala (`ExitDoor` y efectos encadenados
   * entre acertijos y objetos interactivos).
   */
  public wireInternalObservers(): void {
    for (const puzzle of this.puzzles.values()) {
      // ExitDoor se suscribe antes que el observador interno de Room para que
      // `exitDoor.getIsOpen()` ya esté actualizado al emitir `RoomSnapshot`.
      if (this.exitDoor.linkedPuzzleId === puzzle.getId()) {
        puzzle.detach(this.exitDoor);
        puzzle.attach(this.exitDoor);
      }

      puzzle.detach(this.internalPuzzleObserver);
      puzzle.attach(this.internalPuzzleObserver);
    }
  }

  public attach(observer: IObserver<RoomSnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<RoomSnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: RoomSnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }

  /**
   * Realiza una clonación profunda de toda la sala (objetos, acertijos, estrategias
   * y puerta de salida), dejando lista una nueva instancia aislada para reiniciar partida.
   */
  public clone(): Room {
    const clonedDoor = this.exitDoor.clone();
    const clonedObjects = new Map<string, InteractiveObject>();

    for (const [id, obj] of this.interactiveObjects.entries()) {
      if (id === clonedDoor.id) {
        clonedObjects.set(id, clonedDoor);
      } else {
        clonedObjects.set(id, obj.clone());
      }
    }

    const clonedPuzzles = new Map<string, Puzzle>();
    for (const [id, puzzle] of this.puzzles.entries()) {
      clonedPuzzles.set(id, puzzle.clone());
    }

    return new Room({
      dimensions: { ...this.dimensions },
      themeConfiguration: {
        themeType: this.themeConfiguration.themeType,
        colorPalette: { ...this.themeConfiguration.colorPalette },
        lightingConfig: { ...this.themeConfiguration.lightingConfig },
        narrativeConfig: { ...this.themeConfiguration.narrativeConfig },
        audioConfig: { ...this.themeConfiguration.audioConfig },
      },
      interactiveObjects: clonedObjects,
      puzzles: clonedPuzzles,
      exitDoor: clonedDoor,
      timeLimitSeconds: this.timeLimitSeconds,
      puzzleSolvedEffects: this.puzzleSolvedEffects.map((effect) => ({ ...effect })),
      status: this.status,
    });
  }

  private handlePuzzleUpdate(snapshot: PuzzleSnapshot): void {
    if (snapshot.eventType !== 'solved') {
      return;
    }

    for (const effect of this.puzzleSolvedEffects) {
      if (effect.puzzleId !== snapshot.puzzleId) {
        continue;
      }

      const target = this.interactiveObjects.get(effect.targetObjectId);
      if (!target) {
        continue;
      }

      if (effect.unlock) {
        target.unlock();
      }
      if (effect.activate) {
        target.activate();
      }
      if (effect.setVisible !== undefined) {
        target.setVisible(effect.setVisible);
      }
      if (effect.newPrompt !== undefined) {
        target.setInteractionPrompt(effect.newPrompt);
      }
      if (effect.newDescription !== undefined) {
        target.setDescription(effect.newDescription);
      }
      if (effect.newNoteContent !== undefined) {
        target.setNoteContent(effect.newNoteContent);
      }
    }

    if (
      this.exitDoor.linkedPuzzleId === snapshot.puzzleId &&
      this.exitDoor.getIsOpen()
    ) {
      this.status = 'escaped';
    }

    this.lastEventMessage = snapshot.lastMessage;
    this.notify(this.getSnapshot());
  }
}
