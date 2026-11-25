/**
 * @pattern MVC (Arquitectónico)
 * @role First-Person Camera & Collision Controller (Vista 3D)
 *
 * Problema de diseño que resuelve:
 * Administra la cámara en primera persona (`THREE.PerspectiveCamera`, altura 1.65 m),
 * la captura/liberación del cursor mediante Pointer Lock API, el movimiento WASD/flechas
 * con pitch acotado (±80°) y la detección de colisiones AABB con deslizamiento suave
 * contra las 4 paredes y muebles sólidos de la sala.
 */

import * as THREE from 'three';
import type { RoomDimensions } from '../../model/entities/Room';
import type { ColliderBox } from '../builders3d/RoomMeshFactory';

/**
 * Callback notificado cuando cambia el estado de bloqueo de Pointer Lock.
 */
export type PointerLockListener = (locked: boolean) => void;

/**
 * Controlador de cámara FPS y colisiones AABB para la Vista 3D.
 */
export class CameraController {
  public static readonly EYE_HEIGHT_METERS = 1.65;
  public static readonly PLAYER_RADIUS_METERS = 0.38;
  public static readonly MOVE_SPEED_MPS = 3.8;
  public static readonly MOUSE_SENSITIVITY = 0.0021;
  public static readonly MAX_PITCH_RADIANS = (80 * Math.PI) / 180;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly pressedKeys: Set<string>;
  private readonly lockListeners: Set<PointerLockListener>;

  private colliders: readonly ColliderBox[];
  private roomWidth: number;
  private roomDepth: number;
  private yaw: number;
  private pitch: number;
  private locked: boolean;
  private disposed: boolean;

  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;
  private readonly onMouseMoveBound: (event: MouseEvent) => void;
  private readonly onPointerLockChangeBound: () => void;
  private readonly onWindowBlurBound: () => void;

  /**
   * @param domElement - Canvas del renderer sobre el cual se solicita Pointer Lock.
   * @param aspect - Relación de aspecto inicial del viewport.
   */
  constructor(domElement: HTMLElement, aspect: number) {
    this.domElement = domElement;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.08, 60);
    this.camera.rotation.order = 'YXZ';

    this.pressedKeys = new Set<string>();
    this.lockListeners = new Set<PointerLockListener>();
    this.colliders = [];
    this.roomWidth = 10;
    this.roomDepth = 10;
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this.disposed = false;

    this.resetPose();

    this.onKeyDownBound = (event: KeyboardEvent): void => {
      this.pressedKeys.add(event.code);
    };

    this.onKeyUpBound = (event: KeyboardEvent): void => {
      this.pressedKeys.delete(event.code);
    };

    this.onMouseMoveBound = (event: MouseEvent): void => {
      if (!this.locked) {
        return;
      }

      this.yaw -= event.movementX * CameraController.MOUSE_SENSITIVITY;
      this.pitch -= event.movementY * CameraController.MOUSE_SENSITIVITY;
      this.pitch = Math.max(
        -CameraController.MAX_PITCH_RADIANS,
        Math.min(CameraController.MAX_PITCH_RADIANS, this.pitch)
      );
      this.applyRotation();
    };

    this.onPointerLockChangeBound = (): void => {
      const nowLocked = document.pointerLockElement === this.domElement;
      this.locked = nowLocked;
      if (!nowLocked) {
        this.pressedKeys.clear();
      }
      for (const listener of this.lockListeners) {
        listener(nowLocked);
      }
    };

    this.onWindowBlurBound = (): void => {
      this.pressedKeys.clear();
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onWindowBlurBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Configura los límites físicos de la sala y las cajas AABB de muebles sólidos.
   */
  public setRoomBounds(
    dimensions: RoomDimensions,
    colliders: readonly ColliderBox[]
  ): void {
    this.roomWidth = dimensions.width;
    this.roomDepth = dimensions.depth;
    this.colliders = colliders;
  }

  /**
   * Ubica al jugador en el punto inicial mirando hacia el portón norte.
   */
  public resetPose(): void {
    this.camera.position.set(0, CameraController.EYE_HEIGHT_METERS, 3.25);
    this.yaw = 0;
    this.pitch = -0.04;
    this.applyRotation();
  }

  /**
   * Solicita Pointer Lock sobre el canvas de la escena 3D.
   */
  public lock(): void {
    if (this.disposed || this.isLocked()) {
      return;
    }

    try {
      const result = this.domElement.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Silencio seguro si el navegador rechaza el bloqueo sin gesto válido.
    }
  }

  /**
   * Libera el Pointer Lock (por ejemplo al abrir un modal en Fase 3).
   */
  public unlock(): void {
    if (!this.isLocked()) {
      return;
    }

    try {
      document.exitPointerLock();
    } catch {
      // Silencio seguro si ya estaba liberado.
    }
  }

  public isLocked(): boolean {
    return this.locked && document.pointerLockElement === this.domElement;
  }

  public onLockChange(listener: PointerLockListener): () => void {
    this.lockListeners.add(listener);
    return (): void => {
      this.lockListeners.delete(listener);
    };
  }

  /**
   * Actualiza desplazamiento horizontal FPS con resolución AABB por eje (deslizamiento suave).
   */
  public update(deltaSeconds: number): void {
    if (!this.locked || deltaSeconds <= 0) {
      return;
    }

    let forwardInput = 0;
    let strafeInput = 0;

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) {
      forwardInput += 1;
    }
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) {
      forwardInput -= 1;
    }
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) {
      strafeInput += 1;
    }
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) {
      strafeInput -= 1;
    }

    if (forwardInput === 0 && strafeInput === 0) {
      return;
    }

    const len = Math.hypot(forwardInput, strafeInput);
    const normForward = forwardInput / len;
    const normStrafe = strafeInput / len;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    const moveX = (-sinY * normForward + cosY * normStrafe) *
      CameraController.MOVE_SPEED_MPS *
      deltaSeconds;
    const moveZ = (-cosY * normForward - sinY * normStrafe) *
      CameraController.MOVE_SPEED_MPS *
      deltaSeconds;

    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z;

    const candidateX = currentX + moveX;
    if (!this.isColliding(candidateX, currentZ)) {
      this.camera.position.x = candidateX;
    }

    const resolvedX = this.camera.position.x;
    const candidateZ = currentZ + moveZ;
    if (!this.isColliding(resolvedX, candidateZ)) {
      this.camera.position.z = candidateZ;
    }

    this.camera.position.y = CameraController.EYE_HEIGHT_METERS;
  }

  /**
   * Libera listeners del DOM al destruir la escena.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unlock();
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onWindowBlurBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.lockListeners.clear();
  }

  private applyRotation(): void {
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  private isColliding(x: number, z: number): boolean {
    const r = CameraController.PLAYER_RADIUS_METERS;
    const limitX = this.roomWidth / 2 - r;
    const limitZ = this.roomDepth / 2 - r;

    if (x < -limitX || x > limitX || z < -limitZ || z > limitZ) {
      return true;
    }

    for (const box of this.colliders) {
      if (
        x > box.minX - r &&
        x < box.maxX + r &&
        z > box.minZ - r &&
        z < box.maxZ + r
      ) {
        return true;
      }
    }

    return false;
  }
}
