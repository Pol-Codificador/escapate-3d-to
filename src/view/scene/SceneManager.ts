/**
 * @pattern MVC (Arquitectónico) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Administra el ciclo de renderizado WebGL (`THREE.WebGLRenderer`, escena, niebla,
 * luces temáticas, linterna FPS y animaciones 3D) y observa directamente al Modelo
 * (`Room`, `Puzzle`, `GameTimer`) mediante `IObserver` para revelar pistas UV/holograma,
 * abrir la caja fuerte y la puerta de salida o activar alerta roja cuando quedan `<= 60s`.
 */

import * as THREE from 'three';
import type { IObserver } from '../../core/interfaces/IObserver';
import type { InteractiveObject } from '../../model/entities/InteractiveObject';
import type { Room, RoomSnapshot } from '../../model/entities/Room';
import type { GameTimer, TimerSnapshot } from '../../model/GameTimer';
import type { Puzzle, PuzzleSnapshot } from '../../model/puzzles/Puzzle';
import { SequenceStrategy } from '../../model/puzzles/strategies/SequenceStrategy';
import {
  RoomMeshFactory,
  type BuiltRoom3D,
} from '../builders3d/RoomMeshFactory';
import { CameraController } from './CameraController';
import { RaycastSelector } from './RaycastSelector';

/**
 * Unión de instantáneas del Modelo observadas por la Vista 3D.
 */
export type SceneObservableSnapshot =
  | PuzzleSnapshot
  | RoomSnapshot
  | TimerSnapshot;

/**
 * Gestor principal de la escena 3D FPS en Three.js (capa Vista del MVC).
 */
export class SceneManager implements IObserver<SceneObservableSnapshot> {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraController: CameraController;
  private readonly raycastSelector: RaycastSelector;
  private readonly roomMeshFactory: RoomMeshFactory;

  private readonly ambientLight: THREE.AmbientLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly mainPointLight: THREE.PointLight;
  private readonly flashlight: THREE.SpotLight;

  private currentRoom: Room | null;
  private observedTimer: GameTimer | null;
  private observedPuzzles: Puzzle[];
  private builtRoom: BuiltRoom3D | null;

  private baseAmbientColor: THREE.Color;
  private baseAmbientIntensity: number;
  private baseMainLightColor: THREE.Color;
  private baseMainLightIntensity: number;
  private themeFlickerEnabled: boolean;

  private elapsedTime: number;
  private isCriticalTimerActive: boolean;
  private targetClueReveal: number;
  private currentClueReveal: number;
  private targetSafeOpen: number;
  private currentSafeOpen: number;
  private targetDoorOpen: number;
  private currentDoorOpen: number;

  private readonly onResizeBound: () => void;

  /**
   * @param container - Contenedor DOM donde se monta el `<canvas>` de Three.js.
   */
  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight)
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const aspect =
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.cameraController = new CameraController(
      this.renderer.domElement,
      aspect
    );
    this.raycastSelector = new RaycastSelector();
    this.roomMeshFactory = new RoomMeshFactory();

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x1a1a1a, 0.35);
    this.mainPointLight = new THREE.PointLight(0xffffff, 1.4, 18, 1.3);
    this.mainPointLight.position.set(0, 3.45, 0);
    this.mainPointLight.castShadow = true;
    this.mainPointLight.shadow.mapSize.set(1024, 1024);
    this.mainPointLight.shadow.bias = -0.0015;

    // Linterna suave acoplada a la cámara del jugador
    this.flashlight = new THREE.SpotLight(
      0xfff6e5,
      1.6,
      11.5,
      Math.PI / 5.2,
      0.55,
      1.35
    );
    this.flashlight.position.set(0, -0.06, 0);
    this.flashlight.target.position.set(0, -0.06, -1);
    const camera = this.cameraController.getCamera();
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);

    this.scene.add(camera);
    this.scene.add(this.ambientLight);
    this.scene.add(this.hemiLight);
    this.scene.add(this.mainPointLight);

    this.currentRoom = null;
    this.observedTimer = null;
    this.observedPuzzles = [];
    this.builtRoom = null;

    this.baseAmbientColor = new THREE.Color(0x3a2822);
    this.baseAmbientIntensity = 0.45;
    this.baseMainLightColor = new THREE.Color(0xffb36b);
    this.baseMainLightIntensity = 1.35;
    this.themeFlickerEnabled = false;

    this.elapsedTime = 0;
    this.isCriticalTimerActive = false;
    this.targetClueReveal = 0;
    this.currentClueReveal = 0;
    this.targetSafeOpen = 0;
    this.currentSafeOpen = 0;
    this.targetDoorOpen = 0;
    this.currentDoorOpen = 0;

    this.onResizeBound = (): void => {
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      this.cameraController.setAspect(width / height);
      this.renderer.setSize(width, height);
    };

    window.addEventListener('resize', this.onResizeBound);
  }

  /**
   * Construye la escena 3D completa a partir de una `Room` y se suscribe a sus sujetos.
   */
  public buildRoomScene(room: Room, timer?: GameTimer): void {
    this.detachAllModelObservers();
    this.raycastSelector.clearHighlight();

    if (this.builtRoom) {
      this.scene.remove(this.builtRoom.rootGroup);
      this.builtRoom.dispose();
      this.builtRoom = null;
    }

    this.currentRoom = room;
    this.builtRoom = this.roomMeshFactory.build(room);
    this.scene.add(this.builtRoom.rootGroup);

    const { lightingConfig, colorPalette, themeType } = room.themeConfiguration;
    this.scene.background = new THREE.Color(lightingConfig.fogColor);
    this.scene.fog = new THREE.FogExp2(
      lightingConfig.fogColor,
      lightingConfig.fogDensity
    );

    this.baseAmbientColor = new THREE.Color(lightingConfig.ambientColor);
    this.baseAmbientIntensity = lightingConfig.ambientIntensity;
    this.baseMainLightColor = new THREE.Color(lightingConfig.mainLightColor);
    this.baseMainLightIntensity = lightingConfig.mainLightIntensity;
    this.themeFlickerEnabled = lightingConfig.flickerEnabled;

    this.ambientLight.color.copy(this.baseAmbientColor);
    this.ambientLight.intensity = this.baseAmbientIntensity;
    this.hemiLight.color.copy(this.baseMainLightColor);
    this.hemiLight.groundColor.setHex(colorPalette.floor);
    this.mainPointLight.color.copy(this.baseMainLightColor);
    this.mainPointLight.intensity = this.baseMainLightIntensity;

    this.flashlight.color.setHex(themeType === 'horror' ? 0xffe4b5 : 0xd8f8ff);
    this.flashlight.intensity = themeType === 'horror' ? 1.85 : 1.25;

    this.cameraController.setRoomBounds(
      room.dimensions,
      this.builtRoom.colliders
    );
    this.cameraController.resetPose();

    this.raycastSelector.configure(
      room,
      this.builtRoom.interactiveGroups,
      colorPalette.interactiveHighlight
    );

    this.resetAnimationTargetsFromRoom(room);
    this.attachModelObservers(room, timer);
  }

  /**
   * Reacciona de forma desacoplada a eventos de `Puzzle`, `Room` y `GameTimer`.
   */
  public update(data: SceneObservableSnapshot): void {
    if ('puzzleId' in data) {
      this.handlePuzzleSnapshot(data);
      return;
    }

    if ('remainingSeconds' in data) {
      this.isCriticalTimerActive =
        data.isCritical && data.isRunning && !data.isExpired;
      return;
    }

    if ('isExitOpen' in data) {
      this.syncItemPickupVisibility();
      if (data.isExitOpen) {
        this.applyExitDoorUnlockedState();
      }
    }
  }

  /**
   * Avanza física FPS, animaciones suaves, raycasting y renderiza el frame actual.
   */
  public updateFrame(deltaSeconds: number): InteractiveObject | null {
    this.elapsedTime += deltaSeconds;
    this.cameraController.update(deltaSeconds);

    this.updateLightingEffects();
    this.updateAnimations(deltaSeconds);

    const hovered = this.raycastSelector.update(
      this.cameraController.getCamera()
    );
    this.renderer.render(this.scene, this.cameraController.getCamera());
    return hovered;
  }

  public getCameraController(): CameraController {
    return this.cameraController;
  }

  public getHoveredObject(): InteractiveObject | null {
    return this.raycastSelector.getHoveredObject();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Libera recursos WebGL, listeners y suscripciones Observer.
   */
  public dispose(): void {
    window.removeEventListener('resize', this.onResizeBound);
    this.detachAllModelObservers();
    this.raycastSelector.clearHighlight();
    this.cameraController.dispose();

    if (this.builtRoom) {
      this.scene.remove(this.builtRoom.rootGroup);
      this.builtRoom.dispose();
      this.builtRoom = null;
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private attachModelObservers(room: Room, timer?: GameTimer): void {
    room.attach(this);
    this.observedPuzzles = [...room.getAllPuzzles()];
    for (const puzzle of this.observedPuzzles) {
      puzzle.attach(this);
    }

    if (timer) {
      this.observedTimer = timer;
      timer.attach(this);
      const snapshot = timer.getSnapshot();
      this.isCriticalTimerActive =
        snapshot.isCritical && snapshot.isRunning && !snapshot.isExpired;
    }
  }

  private detachAllModelObservers(): void {
    if (this.currentRoom) {
      this.currentRoom.detach(this);
    }
    for (const puzzle of this.observedPuzzles) {
      puzzle.detach(this);
    }
    this.observedPuzzles = [];

    if (this.observedTimer) {
      this.observedTimer.detach(this);
      this.observedTimer = null;
    }
  }

  private resetAnimationTargetsFromRoom(room: Room): void {
    const seqSolved = room.getPuzzle('sequence_puzzle')?.getIsSolved() ?? false;
    const pinSolved = room.getPuzzle('pin_puzzle')?.getIsSolved() ?? false;
    const exitSolved = room.getPuzzle('exit_puzzle')?.getIsSolved() ?? false;

    this.targetClueReveal = seqSolved ? 1 : 0;
    this.currentClueReveal = this.targetClueReveal;
    this.targetSafeOpen = pinSolved ? 1 : 0;
    this.currentSafeOpen = this.targetSafeOpen;
    this.targetDoorOpen = exitSolved ? 1 : 0;
    this.currentDoorOpen = this.targetDoorOpen;
    this.isCriticalTimerActive = false;

    this.syncSwitchPanelRig();
    this.syncClueWallImmediate(seqSolved);
    this.syncSafeLed(pinSolved);
    this.syncItemPickupVisibility();
    if (exitSolved) {
      this.applyExitDoorUnlockedState();
    }
    this.applyAnimatedTransforms();
  }

  private handlePuzzleSnapshot(snapshot: PuzzleSnapshot): void {
    // Limpia temporalmente el resaltado emisivo para evitar sobrescribir LEDs nuevos
    this.raycastSelector.clearHighlight();

    if (snapshot.puzzleId === 'sequence_puzzle') {
      this.syncSwitchPanelRig();
      if (snapshot.isSolved) {
        this.targetClueReveal = 1;
        this.syncClueWallImmediate(true);
      } else if (snapshot.eventType === 'reset') {
        this.targetClueReveal = 0;
        this.syncClueWallImmediate(false);
      }
      return;
    }

    if (snapshot.puzzleId === 'pin_puzzle') {
      if (snapshot.isSolved) {
        this.targetSafeOpen = 1;
        this.syncSafeLed(true);
        this.syncItemPickupVisibility();
      } else if (snapshot.eventType === 'reset') {
        this.targetSafeOpen = 0;
        this.syncSafeLed(false);
        this.syncItemPickupVisibility();
      }
      return;
    }

    if (snapshot.puzzleId === 'exit_puzzle' && snapshot.isSolved) {
      this.applyExitDoorUnlockedState();
    }
  }

  private syncSwitchPanelRig(): void {
    if (!this.builtRoom?.switchPanelRig || !this.currentRoom) {
      return;
    }

    const seqPuzzle = this.currentRoom.getPuzzle('sequence_puzzle');
    const strategy = seqPuzzle?.getStrategy();
    const isSolved = seqPuzzle?.getIsSolved() ?? false;
    const activeSteps =
      strategy instanceof SequenceStrategy
        ? new Set(strategy.getCurrentSequence())
        : new Set<string>();

    for (const [symbol, lever] of this.builtRoom.switchPanelRig.levers.entries()) {
      const isActive = isSolved || activeSteps.has(symbol);
      lever.pivot.rotation.x = isActive ? -0.45 : 0.45;

      if (isSolved) {
        lever.ledMaterial.color.setHex(0x22c55e);
        lever.ledMaterial.emissive.setHex(0x22c55e);
        lever.ledMaterial.emissiveIntensity = 1.5;
      } else if (isActive) {
        lever.ledMaterial.color.setHex(0xfbbf24);
        lever.ledMaterial.emissive.setHex(0xf59e0b);
        lever.ledMaterial.emissiveIntensity = 1.3;
      } else {
        lever.ledMaterial.color.setHex(0xff3b30);
        lever.ledMaterial.emissive.setHex(0xff2a1f);
        lever.ledMaterial.emissiveIntensity = 0.85;
      }
    }
  }

  private syncClueWallImmediate(revealed: boolean): void {
    const rig = this.builtRoom?.clueWallRig;
    if (!rig) {
      return;
    }

    rig.displayMaterial.map = revealed ? rig.revealedTexture : rig.hiddenTexture;
    rig.displayMaterial.emissiveIntensity = revealed ? 0.72 : 0;
    rig.displayMaterial.needsUpdate = true;
    rig.fixtureBulbMaterial.emissiveIntensity = revealed ? 1.8 : 0;
  }

  private syncSafeLed(unlocked: boolean): void {
    const rig = this.builtRoom?.safeRig;
    if (!rig) {
      return;
    }

    if (unlocked) {
      rig.statusLedMaterial.color.setHex(0x22c55e);
      rig.statusLedMaterial.emissive.setHex(0x22c55e);
      rig.statusLedMaterial.emissiveIntensity = 1.4;
    } else {
      rig.statusLedMaterial.color.setHex(0xff3b30);
      rig.statusLedMaterial.emissive.setHex(0xff2a1f);
      rig.statusLedMaterial.emissiveIntensity = 1.0;
    }
  }

  private syncItemPickupVisibility(): void {
    if (!this.builtRoom || !this.currentRoom) {
      return;
    }

    const pickupModel = this.currentRoom.getObject('reward_item_pickup');
    const pickupGroup = this.builtRoom.interactiveGroups.get('reward_item_pickup');
    if (pickupModel && pickupGroup) {
      pickupGroup.visible = pickupModel.isVisible;
    }
  }

  private applyExitDoorUnlockedState(): void {
    this.targetDoorOpen = 1;
    const rig = this.builtRoom?.exitDoorRig;
    if (!rig) {
      return;
    }

    rig.indicatorMaterial.color.setHex(0x22c55e);
    rig.indicatorMaterial.emissive.setHex(0x22c55e);
    rig.indicatorMaterial.emissiveIntensity = 1.8;
    rig.indicatorLight.color.setHex(0x22c55e);
    rig.indicatorLight.intensity = 1.3;
  }

  private updateLightingEffects(): void {
    let flickerFactor = 1;
    if (this.themeFlickerEnabled) {
      flickerFactor =
        0.95 +
        Math.sin(this.elapsedTime * 7.5) * 0.03 +
        Math.sin(this.elapsedTime * 19.3) * 0.02;
    }

    if (this.isCriticalTimerActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 6.5);
      const redAlert = new THREE.Color(0xc9182b);

      this.ambientLight.color
        .copy(this.baseAmbientColor)
        .lerp(redAlert, 0.35 + pulse * 0.35);
      this.ambientLight.intensity = this.baseAmbientIntensity * (0.9 + pulse * 0.35);

      this.mainPointLight.color
        .copy(this.baseMainLightColor)
        .lerp(redAlert, 0.3 + pulse * 0.45);
      this.mainPointLight.intensity =
        this.baseMainLightIntensity * flickerFactor * (0.78 + pulse * 0.42);
      return;
    }

    this.ambientLight.color.copy(this.baseAmbientColor);
    this.ambientLight.intensity = this.baseAmbientIntensity;
    this.mainPointLight.color.copy(this.baseMainLightColor);
    this.mainPointLight.intensity = this.baseMainLightIntensity * flickerFactor;
  }

  private updateAnimations(deltaSeconds: number): void {
    const smoothRate = Math.min(1, deltaSeconds * 4.5);

    this.currentClueReveal +=
      (this.targetClueReveal - this.currentClueReveal) * smoothRate;
    this.currentSafeOpen +=
      (this.targetSafeOpen - this.currentSafeOpen) * smoothRate;
    this.currentDoorOpen +=
      (this.targetDoorOpen - this.currentDoorOpen) * smoothRate;

    this.applyAnimatedTransforms();

    const itemRig = this.builtRoom?.itemPickupRig;
    if (itemRig && itemRig.rootGroup.visible) {
      itemRig.floatingMesh.rotation.y += deltaSeconds * 1.45;
      itemRig.floatingMesh.position.y =
        itemRig.baseLocalY + Math.sin(this.elapsedTime * 2.8) * 0.035;
    }
  }

  private applyAnimatedTransforms(): void {
    if (!this.builtRoom) {
      return;
    }

    if (this.builtRoom.clueWallRig) {
      this.builtRoom.clueWallRig.revealLight.intensity =
        this.currentClueReveal * 3.6;
    }

    if (this.builtRoom.safeRig) {
      const openAngle = (-105 * Math.PI) / 180;
      this.builtRoom.safeRig.doorPivot.rotation.y =
        this.currentSafeOpen * openAngle;
    }

    const doorRig = this.builtRoom.exitDoorRig;
    if (doorRig) {
      if (doorRig.mode === 'pivot') {
        const leafAngle = (100 * Math.PI) / 180;
        doorRig.leftLeaf.rotation.y = -this.currentDoorOpen * leafAngle;
        doorRig.rightLeaf.rotation.y = this.currentDoorOpen * leafAngle;
      } else {
        const baseHalfOffset = 0.445;
        const slideOffset = this.currentDoorOpen * 0.86;
        doorRig.leftLeaf.position.x = -baseHalfOffset - slideOffset;
        doorRig.rightLeaf.position.x = baseHalfOffset + slideOffset;
      }
    }
  }
}
