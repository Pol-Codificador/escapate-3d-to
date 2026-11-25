/**
 * @pattern MVC (Vista 3D) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Administra la escena Three.js (WebGLRenderer, sombras, iluminación temática, linterna,
 * Cámara FPS y RaycastSelector) y observa directamente al Modelo (`Puzzle`, `Room`,
 * `GameTimer`, `GameManager`) para reflejar en 3D la revelación UV/holográfica, la apertura
 * de la caja fuerte, la visibilidad del ítem, la puerta de salida y la alerta roja crítica.
 */

import * as THREE from 'three';
import type { IObserver } from '../../core/interfaces/IObserver';
import type { ThemeType } from '../../core/interfaces/IThemeFactory';
import type { GameStateSnapshot } from '../../core/singletons/GameManager';
import type { GameTimer, TimerSnapshot } from '../../model/GameTimer';
import type { Room, RoomSnapshot } from '../../model/entities/Room';
import type { PuzzleSnapshot } from '../../model/puzzles/Puzzle';
import { SequenceStrategy } from '../../model/puzzles/strategies/SequenceStrategy';
import { ProceduralTextureFactory } from '../builders3d/ProceduralTextureFactory';
import {
  RoomMeshFactory,
  type BuiltRoomSceneAssets,
  type SwitchLeverSymbol,
} from '../builders3d/RoomMeshFactory';
import { CameraController } from './CameraController';
import { RaycastSelector, type RaycastTargetHit } from './RaycastSelector';

/**
 * Unión de instantáneas del Modelo observadas por `SceneManager`.
 */
export type SceneObservedSnapshot =
  | PuzzleSnapshot
  | RoomSnapshot
  | TimerSnapshot
  | GameStateSnapshot;

/**
 * Gestor principal de la escena 3D y observador reactivo del Modelo.
 */
export class SceneManager implements IObserver<SceneObservedSnapshot> {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraController: CameraController;
  private readonly raycastSelector: RaycastSelector;
  private readonly textureFactory: ProceduralTextureFactory;
  private readonly roomMeshFactory: RoomMeshFactory;

  private ambientLight: THREE.AmbientLight | null;
  private hemiLight: THREE.HemisphereLight | null;
  private mainLight: THREE.PointLight | null;
  private flashlight: THREE.SpotLight | null;

  private observedRoom: Room | null;
  private observedTimer: GameTimer | null;
  private roomAssets: BuiltRoomSceneAssets | null;

  private baseAmbientColor: THREE.Color;
  private baseAmbientIntensity: number;
  private baseMainLightColor: THREE.Color;
  private baseMainLightIntensity: number;
  private flickerEnabled: boolean;

  private elapsedTime: number;
  private isCriticalAlertActive: boolean;

  private switchTargetAngles: Map<SwitchLeverSymbol, number>;
  private clueRevealProgressTarget: number;
  private clueRevealProgressCurrent: number;
  private safeOpenTarget: number;
  private safeOpenCurrent: number;
  private exitOpenTarget: number;
  private exitOpenCurrent: number;

  private readonly handleResizeBound: () => void;

  /**
   * @param container - Elemento HTML donde se monta el `<canvas>` WebGL.
   */
  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight)
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const initialAspect =
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.cameraController = new CameraController(
      this.renderer.domElement,
      initialAspect
    );
    this.raycastSelector = new RaycastSelector();
    this.textureFactory = new ProceduralTextureFactory();
    this.roomMeshFactory = new RoomMeshFactory(this.textureFactory);

    this.ambientLight = null;
    this.hemiLight = null;
    this.mainLight = null;
    this.flashlight = null;

    this.observedRoom = null;
    this.observedTimer = null;
    this.roomAssets = null;

    this.baseAmbientColor = new THREE.Color(0x222222);
    this.baseAmbientIntensity = 0.5;
    this.baseMainLightColor = new THREE.Color(0xffffff);
    this.baseMainLightIntensity = 1.4;
    this.flickerEnabled = false;

    this.elapsedTime = 0;
    this.isCriticalAlertActive = false;

    this.switchTargetAngles = new Map<SwitchLeverSymbol, number>([
      ['A', -0.45],
      ['B', -0.45],
      ['C', -0.45],
    ]);
    this.clueRevealProgressTarget = 0;
    this.clueRevealProgressCurrent = 0;
    this.safeOpenTarget = 0;
    this.safeOpenCurrent = 0;
    this.exitOpenTarget = 0;
    this.exitOpenCurrent = 0;

    this.setupPlayerFlashlight();

    this.handleResizeBound = (): void => {
      this.handleResize();
    };
    window.addEventListener('resize', this.handleResizeBound);
  }

  /**
   * Suscribe `SceneManager` al reloj del Modelo para reaccionar al umbral crítico (`<= 60s`).
   */
  public bindTimer(timer: GameTimer): void {
    if (this.observedTimer === timer) {
      return;
    }
    this.observedTimer?.detach(this);
    this.observedTimer = timer;
    this.observedTimer.attach(this);
  }

  /**
   * Construye o reconstruye la escena 3D completa a partir de una `Room` del Modelo
   * y conecta los observadores sobre `Room` y sus `Puzzle`.
   */
  public buildRoomScene(room: Room): void {
    this.clearCurrentRoomScene();

    this.observedRoom = room;
    room.attach(this);
    for (const puzzle of room.getAllPuzzles()) {
      puzzle.attach(this);
    }

    const lighting = room.themeConfiguration.lightingConfig;
    const palette = room.themeConfiguration.colorPalette;

    this.scene.background = new THREE.Color(lighting.fogColor);
    this.scene.fog = new THREE.FogExp2(lighting.fogColor, lighting.fogDensity);
    this.raycastSelector.setHighlightColor(palette.interactiveHighlight);

    this.setupRoomLights(room);

    const built = this.roomMeshFactory.buildRoom(room);
    this.roomAssets = built;
    this.scene.add(built.rootGroup);

    this.cameraController.configureBounds(
      room.dimensions.width,
      room.dimensions.depth,
      built.colliders
    );
    this.cameraController.resetPose();

    // Sincronizar estado inicial de acertijos y objetos
    this.isCriticalAlertActive = false;
    this.elapsedTime = 0;

    const seqPuzzle = room.getPuzzle('sequence_puzzle');
    const pinPuzzle = room.getPuzzle('pin_puzzle');
    const exitPuzzle = room.getPuzzle('exit_puzzle');

    const seqSolved = Boolean(seqPuzzle?.getIsSolved());
    this.clueRevealProgressTarget = seqSolved ? 1 : 0;
    this.clueRevealProgressCurrent = this.clueRevealProgressTarget;
    this.syncSwitchPanelVisuals(room);

    const pinSolved = Boolean(pinPuzzle?.getIsSolved());
    this.safeOpenTarget = pinSolved ? 1 : 0;
    this.safeOpenCurrent = this.safeOpenTarget;

    const exitSolved = Boolean(exitPuzzle?.getIsSolved() || room.exitDoor.getIsOpen());
    this.exitOpenTarget = exitSolved ? 1 : 0;
    this.exitOpenCurrent = this.exitOpenTarget;
    this.cameraController.setColliderActive('exit_door', !exitSolved);
  }

  /**
   * Reacciona automáticamente a cambios emitidos por `Puzzle`, `Room`, `GameTimer` o `GameManager`.
   */
  public update(data: SceneObservedSnapshot): void {
    if ('remainingSeconds' in data) {
      this.handleTimerSnapshot(data);
      return;
    }

    if ('puzzleId' in data) {
      this.handlePuzzleSnapshot(data);
      return;
    }

    if ('isExitOpen' in data) {
      this.handleRoomSnapshot(data);
      return;
    }

    if ('lifecycleState' in data && data.lifecycleState === 'menu') {
      this.isCriticalAlertActive = false;
    }
  }

  /**
   * Avanza animaciones 3D, física de cámara, raycasting y renderiza el frame actual.
   */
  public renderFrame(deltaSeconds: number): RaycastTargetHit | null {
    this.elapsedTime += deltaSeconds;
    this.cameraController.update(deltaSeconds);
    this.updateAnimations(deltaSeconds);

    const hit = this.roomAssets
      ? this.raycastSelector.update(
          this.cameraController.camera,
          this.roomAssets.interactiveGroups
        )
      : null;

    this.renderer.render(this.scene, this.cameraController.camera);
    return hit;
  }

  public getCameraController(): CameraController {
    return this.cameraController;
  }

  public getRaycastSelection(): RaycastTargetHit | null {
    return this.raycastSelector.getCurrentSelection();
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public dispose(): void {
    window.removeEventListener('resize', this.handleResizeBound);
    this.observedTimer?.detach(this);
    this.clearCurrentRoomScene();
    this.cameraController.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private handleTimerSnapshot(snapshot: TimerSnapshot): void {
    this.isCriticalAlertActive =
      snapshot.isCritical && snapshot.isRunning && !snapshot.isExpired;

    if (!this.isCriticalAlertActive && this.ambientLight && this.mainLight) {
      this.ambientLight.color.copy(this.baseAmbientColor);
      this.ambientLight.intensity = this.baseAmbientIntensity;
      this.mainLight.color.copy(this.baseMainLightColor);
      this.mainLight.intensity = this.baseMainLightIntensity;
    }
  }

  private handlePuzzleSnapshot(snapshot: PuzzleSnapshot): void {
    if (!this.observedRoom || !this.roomAssets) {
      return;
    }

    if (snapshot.puzzleId === 'sequence_puzzle') {
      this.syncSwitchPanelVisuals(this.observedRoom);

      if (snapshot.isSolved) {
        this.clueRevealProgressTarget = 1;
        this.revealClueWallTexture(
          this.observedRoom.themeConfiguration.themeType,
          true
        );
      }
      return;
    }

    if (snapshot.puzzleId === 'pin_puzzle' && snapshot.isSolved) {
      this.safeOpenTarget = 1;
      this.updateSafeUnlockedVisuals(this.observedRoom.themeConfiguration.themeType);
      this.syncItemPickupVisibility();
      return;
    }

    if (snapshot.puzzleId === 'exit_puzzle' && snapshot.isSolved) {
      this.exitOpenTarget = 1;
      this.updateExitDoorIndicator(true);
      this.cameraController.setColliderActive('exit_door', false);
    }
  }

  private handleRoomSnapshot(snapshot: RoomSnapshot): void {
    this.syncItemPickupVisibility();
    if (snapshot.isExitOpen) {
      this.exitOpenTarget = 1;
      this.updateExitDoorIndicator(true);
      this.cameraController.setColliderActive('exit_door', false);
    }
  }

  private syncSwitchPanelVisuals(room: Room): void {
    if (!this.roomAssets) {
      return;
    }

    this.raycastSelector.clearHighlight();
    const puzzle = room.getPuzzle('sequence_puzzle');
    const isSolved = Boolean(puzzle?.getIsSolved());
    const strategy = puzzle?.getStrategy();
    const activeSteps =
      strategy instanceof SequenceStrategy ? strategy.getCurrentSequence() : [];

    for (const [symbol, handle] of this.roomAssets.switchHandles.entries()) {
      const active = isSolved || activeSteps.includes(symbol);
      this.switchTargetAngles.set(symbol, active ? 0.45 : -0.45);

      if (isSolved) {
        handle.ledMaterial.color.setHex(0x1b6e3c);
        handle.ledMaterial.emissive.setHex(0x22ee77);
        handle.ledMaterial.emissiveIntensity = 1.25;
      } else if (active) {
        handle.ledMaterial.color.setHex(0x8c6d1f);
        handle.ledMaterial.emissive.setHex(0xffc300);
        handle.ledMaterial.emissiveIntensity = 1.1;
      } else {
        handle.ledMaterial.color.setHex(0x3b1818);
        handle.ledMaterial.emissive.setHex(0xaa2222);
        handle.ledMaterial.emissiveIntensity = 0.5;
      }
    }
  }

  private revealClueWallTexture(theme: ThemeType, revealed: boolean): void {
    const handles = this.roomAssets?.clueWallHandles;
    if (!handles) {
      return;
    }

    this.raycastSelector.clearHighlight();

    const oldMap = handles.panelMaterial.map;
    const newTexture = this.textureFactory.createClueWallTexture(
      theme,
      handles.secretPin,
      revealed
    );
    this.roomAssets?.disposableTextures.push(newTexture);

    handles.panelMaterial.map = newTexture;
    handles.panelMaterial.emissiveMap = newTexture;
    handles.panelMaterial.emissive.setHex(
      revealed ? (theme === 'horror' ? 0x9d4edd : 0x00f5d4) : 0x000000
    );
    handles.panelMaterial.emissiveIntensity = revealed ? 0.72 : 0;
    handles.panelMaterial.needsUpdate = true;
    oldMap?.dispose();
  }

  private updateSafeUnlockedVisuals(theme: ThemeType): void {
    const safeHandles = this.roomAssets?.safeHandles;
    if (!safeHandles) {
      return;
    }

    this.raycastSelector.clearHighlight();

    const oldKeypadMap = safeHandles.keypadMaterial.map;
    const openKeypadTex = this.textureFactory.createKeypadTexture(theme, true);
    this.roomAssets?.disposableTextures.push(openKeypadTex);

    safeHandles.keypadMaterial.map = openKeypadTex;
    safeHandles.keypadMaterial.needsUpdate = true;
    oldKeypadMap?.dispose();

    safeHandles.statusLedMaterial.color.setHex(0x22cc66);
    safeHandles.statusLedMaterial.emissive.setHex(0x22ff88);
    safeHandles.interiorLight.intensity = 1.2;
  }

  private syncItemPickupVisibility(): void {
    if (!this.observedRoom || !this.roomAssets?.itemPickupGroup) {
      return;
    }
    const pickupObj = this.observedRoom.getObject('reward_item_pickup');
    const shouldShow = Boolean(pickupObj?.isVisible);
    if (!shouldShow && this.raycastSelector.getCurrentSelection()?.objectId === 'reward_item_pickup') {
      this.raycastSelector.clearHighlight();
    }
    this.roomAssets.itemPickupGroup.visible = shouldShow;
  }

  private updateExitDoorIndicator(isOpen: boolean): void {
    const handles = this.roomAssets?.exitDoorHandles;
    if (!handles) {
      return;
    }

    this.raycastSelector.clearHighlight();
    handles.statusLightMaterial.color.setHex(isOpen ? 0x22ee77 : 0xee3333);
    handles.statusLightMaterial.emissive.setHex(isOpen ? 0x22ff88 : 0xff2222);
    handles.statusPointLight.color.setHex(isOpen ? 0x22ff88 : 0xff3333);
  }

  private updateAnimations(deltaSeconds: number): void {
    if (!this.roomAssets) {
      return;
    }

    const lerpFactor = Math.min(1, deltaSeconds * 6);

    // 1. Palancas del panel de interruptores
    for (const [symbol, handle] of this.roomAssets.switchHandles.entries()) {
      const targetAngle = this.switchTargetAngles.get(symbol) ?? -0.45;
      handle.leverPivot.rotation.x = THREE.MathUtils.lerp(
        handle.leverPivot.rotation.x,
        targetAngle,
        Math.min(1, deltaSeconds * 10)
      );
    }

    // 2. Luz UV / Holograma de clue_wall
    if (this.roomAssets.clueWallHandles) {
      this.clueRevealProgressCurrent = THREE.MathUtils.lerp(
        this.clueRevealProgressCurrent,
        this.clueRevealProgressTarget,
        lerpFactor
      );
      this.roomAssets.clueWallHandles.spotLight.intensity =
        3.6 * this.clueRevealProgressCurrent;
      this.roomAssets.clueWallHandles.accentPointLight.intensity =
        1.25 * this.clueRevealProgressCurrent;
    }

    // 3. Apertura de puerta de caja fuerte (~105 grados hacia afuera)
    if (this.roomAssets.safeHandles) {
      this.safeOpenCurrent = THREE.MathUtils.lerp(
        this.safeOpenCurrent,
        this.safeOpenTarget,
        lerpFactor
      );
      this.roomAssets.safeHandles.doorPivot.rotation.y =
        -THREE.MathUtils.degToRad(105) * this.safeOpenCurrent;
    }

    // 4. Rotación y flotación suave del ítem de recompensa cuando está visible
    if (
      this.roomAssets.itemPickupGroup &&
      this.roomAssets.itemPickupGroup.visible
    ) {
      this.roomAssets.itemPickupGroup.rotation.y += deltaSeconds * 1.4;
      this.roomAssets.itemPickupGroup.position.y =
        this.roomAssets.itemPickupBaseY + Math.sin(this.elapsedTime * 2.6) * 0.04;
    }

    // 5. Apertura suave de la puerta de salida
    if (this.roomAssets.exitDoorHandles) {
      this.exitOpenCurrent = THREE.MathUtils.lerp(
        this.exitOpenCurrent,
        this.exitOpenTarget,
        Math.min(1, deltaSeconds * 4.5)
      );
      const { leftWingPivot, rightWingPivot, openMode } =
        this.roomAssets.exitDoorHandles;

      if (openMode === 'swing') {
        const angle = THREE.MathUtils.degToRad(85) * this.exitOpenCurrent;
        leftWingPivot.rotation.y = -angle;
        rightWingPivot.rotation.y = angle;
      } else {
        const baseOffset = 0.375;
        const slideDistance = 0.78 * this.exitOpenCurrent;
        leftWingPivot.position.x = -baseOffset - slideDistance;
        rightWingPivot.position.x = baseOffset + slideDistance;
      }
    }

    // 6. Iluminación atmosférica o parpadeo rojo de alerta crítica (<= 60s)
    if (this.ambientLight && this.mainLight) {
      if (this.isCriticalAlertActive) {
        const pulse = (Math.sin(this.elapsedTime * 6.2) + 1) * 0.5;
        const alertColor = new THREE.Color(0xd62828);
        this.ambientLight.color
          .copy(this.baseAmbientColor)
          .lerp(alertColor, 0.35 + pulse * 0.45);
        this.ambientLight.intensity =
          this.baseAmbientIntensity * (0.85 + pulse * 0.45);
        this.mainLight.color
          .copy(this.baseMainLightColor)
          .lerp(alertColor, 0.25 + pulse * 0.45);
        this.mainLight.intensity =
          this.baseMainLightIntensity * (0.7 + pulse * 0.45);
      } else if (this.flickerEnabled) {
        const jitter =
          0.94 +
          0.06 *
            Math.sin(this.elapsedTime * 11.3) *
            Math.cos(this.elapsedTime * 4.7);
        this.mainLight.intensity = this.baseMainLightIntensity * jitter;
      }
    }
  }

  private setupPlayerFlashlight(): void {
    const flashlight = new THREE.SpotLight(
      0xfff6e5,
      1.7,
      11.5,
      Math.PI / 5.5,
      0.6,
      1.4
    );
    flashlight.position.set(0, 0, 0);
    const target = new THREE.Object3D();
    target.position.set(0, 0, -1);
    this.cameraController.camera.add(flashlight);
    this.cameraController.camera.add(target);
    flashlight.target = target;
    this.scene.add(this.cameraController.camera);
    this.flashlight = flashlight;
  }

  private setupRoomLights(room: Room): void {
    const lighting = room.themeConfiguration.lightingConfig;
    const isHorror = room.themeConfiguration.themeType === 'horror';

    this.baseAmbientColor.setHex(lighting.ambientColor);
    this.baseAmbientIntensity = lighting.ambientIntensity + 0.35;
    this.baseMainLightColor.setHex(lighting.mainLightColor);
    this.baseMainLightIntensity = lighting.mainLightIntensity * 8.5;
    this.flickerEnabled = lighting.flickerEnabled;

    this.ambientLight = new THREE.AmbientLight(
      this.baseAmbientColor,
      this.baseAmbientIntensity
    );
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(
      lighting.mainLightColor,
      lighting.ambientColor,
      isHorror ? 0.35 : 0.55
    );
    this.hemiLight.position.set(0, room.dimensions.height, 0);
    this.scene.add(this.hemiLight);

    this.mainLight = new THREE.PointLight(
      this.baseMainLightColor,
      this.baseMainLightIntensity,
      16,
      1.6
    );
    this.mainLight.position.set(0, room.dimensions.height - 0.65, 0);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.set(1024, 1024);
    this.mainLight.shadow.bias = -0.002;
    this.scene.add(this.mainLight);

    if (this.flashlight) {
      this.flashlight.color.setHex(isHorror ? 0xffe4b8 : 0xd8f3ff);
      this.flashlight.intensity = isHorror ? 2.4 : 1.5;
    }
  }

  private clearCurrentRoomScene(): void {
    this.raycastSelector.clearHighlight();

    if (this.observedRoom) {
      this.observedRoom.detach(this);
      for (const puzzle of this.observedRoom.getAllPuzzles()) {
        puzzle.detach(this);
      }
      this.observedRoom = null;
    }

    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.hemiLight) {
      this.scene.remove(this.hemiLight);
      this.hemiLight = null;
    }
    if (this.mainLight) {
      this.scene.remove(this.mainLight);
      this.mainLight = null;
    }

    if (this.roomAssets) {
      this.scene.remove(this.roomAssets.rootGroup);
      this.disposeGroupResources(this.roomAssets.rootGroup);
      for (const tex of this.roomAssets.disposableTextures) {
        tex.dispose();
      }
      this.roomAssets = null;
    }
  }

  private disposeGroupResources(group: THREE.Group): void {
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.map?.dispose();
          mat.emissiveMap?.dispose();
        }
        mat.dispose();
      }
    });
  }

  private handleResize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.cameraController.setAspect(width / height);
    this.renderer.setSize(width, height);
  }
}
