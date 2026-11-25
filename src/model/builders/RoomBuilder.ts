/**
 * @pattern Builder (GoF Creacional)
 * @role ConcreteBuilder
 *
 * Problema de diseño que resuelve:
 * Separa la construcción paso a paso de una entidad `Room` compleja (dimensiones,
 * configuración temática, tiempo límite, diccionario de objetos interactivos,
 * acertijos, puerta de salida y reglas encadenadas) de su representación final,
 * ofreciendo una interfaz fluida y reiniciable.
 */

import type { ExitDoor } from '../entities/ExitDoor';
import type { InteractiveObject } from '../entities/InteractiveObject';
import {
  Room,
  type PuzzleSolvedEffect,
  type RoomDimensions,
  type RoomThemeConfiguration,
} from '../entities/Room';
import type { Puzzle } from '../puzzles/Puzzle';

/**
 * Constructor fluido encargado de ensamblar una instancia válida de `Room`.
 */
export class RoomBuilder {
  private dimensions: RoomDimensions;
  private themeConfiguration: RoomThemeConfiguration | null;
  private timeLimitSeconds: number;
  private interactiveObjects: Map<string, InteractiveObject>;
  private puzzles: Map<string, Puzzle>;
  private exitDoor: ExitDoor | null;
  private puzzleSolvedEffects: PuzzleSolvedEffect[];

  constructor() {
    this.dimensions = { width: 10, height: 4, depth: 10 };
    this.themeConfiguration = null;
    this.timeLimitSeconds = 300;
    this.interactiveObjects = new Map<string, InteractiveObject>();
    this.puzzles = new Map<string, Puzzle>();
    this.exitDoor = null;
    this.puzzleSolvedEffects = [];
  }

  /**
   * Reinicia el estado interno del builder para construir una nueva sala limpia.
   */
  public reset(): this {
    this.dimensions = { width: 10, height: 4, depth: 10 };
    this.themeConfiguration = null;
    this.timeLimitSeconds = 300;
    this.interactiveObjects = new Map<string, InteractiveObject>();
    this.puzzles = new Map<string, Puzzle>();
    this.exitDoor = null;
    this.puzzleSolvedEffects = [];
    return this;
  }

  /**
   * Define las dimensiones espaciales de la sala en metros.
   */
  public setDimensions(width: number, height: number, depth: number): this {
    this.dimensions = { width, height, depth };
    return this;
  }

  /**
   * Asigna la familia completa de configuración temática producida por `IThemeFactory`.
   */
  public setThemeConfiguration(config: RoomThemeConfiguration): this {
    this.themeConfiguration = config;
    return this;
  }

  /**
   * Define el tiempo límite de la sala en segundos (por defecto 300).
   */
  public setTimeLimit(seconds: number): this {
    this.timeLimitSeconds = Math.max(1, seconds);
    return this;
  }

  /**
   * Registra un acertijo en el mapa de acertijos de la sala.
   */
  public addPuzzle(puzzle: Puzzle): this {
    this.puzzles.set(puzzle.getId(), puzzle);
    return this;
  }

  /**
   * Registra un objeto interactivo dentro de la sala.
   */
  public addInteractiveObject(object: InteractiveObject): this {
    this.interactiveObjects.set(object.id, object);
    return this;
  }

  /**
   * Define la puerta de salida observable de la sala.
   */
  public setExitDoor(exitDoor: ExitDoor): this {
    this.exitDoor = exitDoor;
    this.interactiveObjects.set(exitDoor.id, exitDoor);
    return this;
  }

  /**
   * Registra un efecto encadenado que ocurre cuando un acertijo se resuelve.
   */
  public addPuzzleSolvedEffect(effect: PuzzleSolvedEffect): this {
    this.puzzleSolvedEffects.push(effect);
    return this;
  }

  /**
   * Valida las precondiciones mínimas y construye el producto `Room`.
   */
  public build(): Room {
    if (!this.themeConfiguration) {
      throw new Error(
        'RoomBuilder.build(): falta setThemeConfiguration() antes de construir la sala.'
      );
    }

    if (!this.exitDoor) {
      throw new Error(
        'RoomBuilder.build(): falta setExitDoor() antes de construir la sala.'
      );
    }

    const builtRoom = new Room({
      dimensions: this.dimensions,
      themeConfiguration: this.themeConfiguration,
      interactiveObjects: this.interactiveObjects,
      puzzles: this.puzzles,
      exitDoor: this.exitDoor,
      timeLimitSeconds: this.timeLimitSeconds,
      puzzleSolvedEffects: this.puzzleSolvedEffects,
    });

    this.reset();
    return builtRoom;
  }
}
