/**
 * @pattern Singleton (GoF Creacional) + Observer (GoF Comportamental)
 * @role Singleton & ConcreteSubject
 *
 * Problema de diseño que resuelve:
 * Centraliza en un único punto controlado el ciclo de vida de la partida
 * (`'menu' | 'playing' | 'paused' | 'won' | 'lost'`), coordina `RoomDirector`,
 * `IThemeFactory`, `GameTimer`, `Inventory` y `AudioManager`, y conserva un prototipo
 * intacto de la sala (`roomPrototype`) para reiniciar instantáneamente vía `clone()`.
 */

import type { IObserver, ISubject } from '../interfaces/IObserver';
import type { IThemeFactory, ThemeType } from '../interfaces/IThemeFactory';
import { RoomDirector } from '../../model/builders/RoomDirector';
import { Inventory } from '../../model/entities/Inventory';
import { Room, type RoomSnapshot } from '../../model/entities/Room';
import { HorrorThemeFactory } from '../../model/factories/HorrorThemeFactory';
import { SciFiThemeFactory } from '../../model/factories/SciFiThemeFactory';
import { GameTimer, type TimerSnapshot } from '../../model/GameTimer';
import { AudioManager } from './AudioManager';

/**
 * Estados oficiales del ciclo de vida de la partida.
 */
export type GameLifecycleState = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

/**
 * Instantánea global del estado de juego emitida por `GameManager`.
 */
export interface GameStateSnapshot {
  readonly lifecycleState: GameLifecycleState;
  readonly themeType: ThemeType | null;
  readonly roomTitle: string;
  readonly statusMessage: string;
  readonly solvedCount: number;
  readonly totalPuzzles: number;
  readonly remainingFormattedTime: string;
}

/**
 * Gestor principal único del Escape Room (Patrón Singleton).
 */
export class GameManager implements ISubject<GameStateSnapshot> {
  private static instance: GameManager | null = null;

  private readonly roomDirector: RoomDirector;
  private readonly timer: GameTimer;
  private readonly inventory: Inventory;
  private readonly audioManager: AudioManager;

  private lifecycleState: GameLifecycleState;
  private activeFactory: IThemeFactory | null;
  private roomPrototype: Room | null;
  private currentRoom: Room | null;
  private statusMessage: string;
  private observers: Set<IObserver<GameStateSnapshot>>;

  private readonly timerObserver: IObserver<TimerSnapshot>;
  private readonly roomObserver: IObserver<RoomSnapshot>;

  private constructor() {
    this.roomDirector = new RoomDirector();
    this.timer = new GameTimer(RoomDirector.DEFAULT_TIME_LIMIT_SECONDS);
    this.inventory = new Inventory(5);
    this.audioManager = AudioManager.getInstance();

    this.lifecycleState = 'menu';
    this.activeFactory = null;
    this.roomPrototype = null;
    this.currentRoom = null;
    this.statusMessage = 'Selecciona una temática para iniciar el Escape Room.';
    this.observers = new Set<IObserver<GameStateSnapshot>>();

    this.timerObserver = {
      update: (snapshot: TimerSnapshot): void => {
        if (snapshot.isExpired && this.lifecycleState === 'playing') {
          this.handleTimeExpired();
        }
      },
    };

    this.roomObserver = {
      update: (snapshot: RoomSnapshot): void => {
        if (snapshot.status === 'escaped' && this.lifecycleState === 'playing') {
          this.handleVictory();
        } else {
          this.statusMessage = snapshot.lastEventMessage;
          this.notify(this.getSnapshot());
        }
      },
    };

    this.timer.attach(this.timerObserver);
    this.timer.attach(this.audioManager);
    this.inventory.attach(this.audioManager);
  }

  /**
   * Devuelve la instancia única global de `GameManager`.
   */
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Inicia una nueva partida construyendo el prototipo de sala con `RoomDirector`
   * e instanciando la sala jugable mediante `roomPrototype.clone()`.
   *
   * @param themeOrFactory - Identificador `'horror' | 'scifi'` o fábrica concreta `IThemeFactory`.
   */
  public startGame(themeOrFactory: ThemeType | IThemeFactory): Room {
    const factory = this.resolveThemeFactory(themeOrFactory);
    this.activeFactory = factory;

    // Construimos y conservamos el prototipo limpio sin mutarlo durante la partida.
    this.roomPrototype = this.roomDirector.constructRoom(factory);
    return this.initializePlayableRoomFromPrototype();
  }

  /**
   * Reinicia la partida al instante clonando profundamente `roomPrototype`
   * (Patrón Prototype) sin reconstruir manualmente la geometría lógica ni la temática.
   */
  public restartGame(): Room {
    if (!this.roomPrototype) {
      if (this.activeFactory) {
        this.roomPrototype = this.roomDirector.constructRoom(this.activeFactory);
      } else {
        throw new Error(
          'GameManager.restartGame(): no hay una partida previa ni temática activa.'
        );
      }
    }

    return this.initializePlayableRoomFromPrototype();
  }

  /**
   * Pausa la partida y detiene temporalmente `GameTimer`.
   */
  public pauseGame(): void {
    if (this.lifecycleState !== 'playing') {
      return;
    }

    this.lifecycleState = 'paused';
    this.timer.pause();
    this.statusMessage = 'Partida en pausa.';
    this.notify(this.getSnapshot());
  }

  /**
   * Reanuda una partida previamente pausada.
   */
  public resumeGame(): void {
    if (this.lifecycleState !== 'paused') {
      return;
    }

    this.lifecycleState = 'playing';
    this.timer.start();
    this.statusMessage = 'Partida reanudada.';
    this.notify(this.getSnapshot());
  }

  /**
   * Finaliza la sesión actual y regresa al menú principal.
   */
  public returnToMenu(): void {
    this.detachRoomObservers();
    this.timer.pause();
    this.timer.reset(RoomDirector.DEFAULT_TIME_LIMIT_SECONDS);
    this.inventory.clear();
    this.lifecycleState = 'menu';
    this.currentRoom = null;
    this.statusMessage = 'Selecciona una temática para iniciar el Escape Room.';
    this.notify(this.getSnapshot());
  }

  /**
   * Avanza el reloj de la simulación mientras la partida esté en estado `'playing'`.
   *
   * @param deltaSeconds - Delta de tiempo en segundos.
   */
  public update(deltaSeconds: number): void {
    if (this.lifecycleState !== 'playing') {
      return;
    }
    this.timer.tick(deltaSeconds);
  }

  public getLifecycleState(): GameLifecycleState {
    return this.lifecycleState;
  }

  public getCurrentRoom(): Room | null {
    return this.currentRoom;
  }

  public getRoomPrototype(): Room | null {
    return this.roomPrototype;
  }

  public getTimer(): GameTimer {
    return this.timer;
  }

  public getInventory(): Inventory {
    return this.inventory;
  }

  public getAudioManager(): AudioManager {
    return this.audioManager;
  }

  public getActiveThemeFactory(): IThemeFactory | null {
    return this.activeFactory;
  }

  public getSnapshot(): GameStateSnapshot {
    const room = this.currentRoom;
    return {
      lifecycleState: this.lifecycleState,
      themeType: room ? room.themeConfiguration.themeType : null,
      roomTitle: room ? room.themeConfiguration.narrativeConfig.roomTitle : '',
      statusMessage: this.statusMessage,
      solvedCount: room ? room.getSolvedPuzzleIds().length : 0,
      totalPuzzles: room ? room.puzzles.size : 0,
      remainingFormattedTime: this.timer.getFormattedTime(),
    };
  }

  public attach(observer: IObserver<GameStateSnapshot>): void {
    this.observers.add(observer);
  }

  public detach(observer: IObserver<GameStateSnapshot>): void {
    this.observers.delete(observer);
  }

  public notify(data: GameStateSnapshot): void {
    for (const observer of this.observers) {
      observer.update(data);
    }
  }

  private initializePlayableRoomFromPrototype(): Room {
    if (!this.roomPrototype) {
      throw new Error('No existe roomPrototype para clonar.');
    }

    this.detachRoomObservers();

    const clonedRoom = this.roomPrototype.clone();
    this.currentRoom = clonedRoom;

    this.attachRoomObservers(clonedRoom);
    this.audioManager.setThemeAudioConfig(
      clonedRoom.themeConfiguration.audioConfig
    );
    this.audioManager.resetTracking();

    this.inventory.clear();
    this.timer.reset(clonedRoom.timeLimitSeconds);
    this.lifecycleState = 'playing';
    this.timer.start();

    this.statusMessage = clonedRoom.themeConfiguration.narrativeConfig.introText;
    this.notify(this.getSnapshot());

    return clonedRoom;
  }

  private resolveThemeFactory(
    themeOrFactory: ThemeType | IThemeFactory
  ): IThemeFactory {
    if (typeof themeOrFactory !== 'string') {
      return themeOrFactory;
    }

    return themeOrFactory === 'scifi'
      ? new SciFiThemeFactory()
      : new HorrorThemeFactory();
  }

  private attachRoomObservers(room: Room): void {
    room.attach(this.roomObserver);
    for (const puzzle of room.getAllPuzzles()) {
      puzzle.attach(this.audioManager);
    }
  }

  private detachRoomObservers(): void {
    if (!this.currentRoom) {
      return;
    }

    this.currentRoom.detach(this.roomObserver);
    for (const puzzle of this.currentRoom.getAllPuzzles()) {
      puzzle.detach(this.audioManager);
    }
  }

  private handleVictory(): void {
    this.timer.pause();
    this.lifecycleState = 'won';
    this.statusMessage =
      this.currentRoom?.themeConfiguration.narrativeConfig.escapeSuccessMessage ??
      '¡Has escapado de la sala!';
    this.notify(this.getSnapshot());
  }

  private handleTimeExpired(): void {
    this.lifecycleState = 'lost';
    const timeoutMessage =
      this.currentRoom?.themeConfiguration.narrativeConfig.timeOutMessage ??
      'Se acabó el tiempo.';
    this.currentRoom?.setStatus('failed', timeoutMessage);
    this.statusMessage = timeoutMessage;
    this.notify(this.getSnapshot());
  }
}
