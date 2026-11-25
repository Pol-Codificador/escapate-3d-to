/**
 * @pattern MVC (Vista — Controlador de Cámara FPS y Colisiones)
 * @role View FPS Camera
 *
 * Problema de diseño que resuelve:
 * Administra la cámara en primera persona (`THREE.PerspectiveCamera` a 1.65 m de altura),
 * la API Pointer Lock, la rotación de mirada limitada (`±80°`) y el desplazamiento `WASD`
 * + flechas con detección de colisiones AABB con deslizamiento suave por ejes X/Z.
 */

import * as THREE from 'three';
import type { ColliderBox2D } from '../builders3d/RoomMeshFactory';

/**
 * Controlador de cámara en primera persona desacoplado de la lógica del Modelo.
 */
export class CameraController {
  public static readonly EYE_HEIGHT = 1.65;
  public static readonly MOVE_SPEED = 3.6;
  public static readonly PLAYER_RADIUS = 0.38;
  public static readonly MOUSE_SENSITIVITY = 0.0022;
  public static readonly MAX_PITCH_RAD = THREE.MathUtils.degToRad(80);

  public readonly camera: THREE.PerspectiveCamera;

  private readonly domElement: HTMLElement;
  private readonly pressedKeys: Set<string>;
  private readonly lockListeners: Set<(locked: boolean) => void>;

  private yaw: number;
  private pitch: number;
  private roomHalfWidth: number;
  private roomHalfDepth: number;
  private colliders: ColliderBox2D[];

  private readonly handleMouseMoveBound: (event: MouseEvent) => void;
  private readonly handleKeyDownBound: (event: KeyboardEvent) => void;
  private readonly handleKeyUpBound: (event: KeyboardEvent) => void;
  private readonly handlePointerLockChangeBound: () => void;
  private readonly handleWindowBlurBound: () => void;

  /**
   * @param domElement - Canvas HTML sobre el cual se solicita Pointer Lock.
   * @param aspect - Relación de aspecto inicial de la cámara.
   */
  constructor(domElement: HTMLElement, aspect = 16 / 9) {
    this.domElement = domElement;
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 60);
    this.camera.rotation.order = 'YXZ';

    this.pressedKeys = new Set<string>();
    this.lockListeners = new Set<(locked: boolean) => void>();
    this.yaw = 0;
    this.pitch = 0;
    this.roomHalfWidth = 5;
    this.roomHalfDepth = 5;
    this.colliders = [];

    this.handleMouseMoveBound = (event: MouseEvent): void => {
      this.onMouseMove(event);
    };
    this.handleKeyDownBound = (event: KeyboardEvent): void => {
      this.onKeyDown(event);
    };
    this.handleKeyUpBound = (event: KeyboardEvent): void => {
      this.onKeyUp(event);
    };
    this.handlePointerLockChangeBound = (): void => {
      this.onPointerLockChange();
    };
    this.handleWindowBlurBound = (): void => {
      this.pressedKeys.clear();
    };

    document.addEventListener('mousemove', this.handleMouseMoveBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    window.addEventListener('blur', this.handleWindowBlurBound);

    this.resetPose();
  }

  /**
   * Configura las dimensiones de la sala y la lista de colisionadores AABB activos.
   */
  public configureBounds(
    roomWidth: number,
    roomDepth: number,
    colliders: ColliderBox2D[]
  ): void {
    this.roomHalfWidth = roomWidth / 2;
    this.roomHalfDepth = roomDepth / 2;
    this.colliders = colliders;
  }

  /**
   * Habilita o deshabilita un colisionador específico (ej. al abrir `exit_door`).
   */
  public setColliderActive(colliderId: string, active: boolean): void {
    for (const collider of this.colliders) {
      if (collider.id === colliderId) {
        collider.active = active;
      }
    }
  }

  /**
   * Reinicia la posición inicial del jugador en el centro-sur de la sala mirando al norte.
   */
  public resetPose(): void {
    this.camera.position.set(0, CameraController.EYE_HEIGHT, 3.2);
    this.yaw = 0;
    this.pitch = 0;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.pressedKeys.clear();
  }

  /**
   * Actualiza la relación de aspecto ante cambios de tamaño de ventana.
   */
  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Activa el Pointer Lock sobre el canvas de juego.
   */
  public lock(): void {
    if (this.isLocked()) {
      return;
    }

    try {
      const result = this.domElement.requestPointerLock() as unknown;
      if (
        result &&
        typeof (result as Promise<void>).catch === 'function'
      ) {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Ignora rechazos de navegador si no hubo gesto de usuario válido.
    }
  }

  /**
   * Libera el Pointer Lock automáticamente (útil al abrir modales en Fase 3).
   */
  public unlock(): void {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
    this.pressedKeys.clear();
  }

  /**
   * Indica si el ratón está actualmente capturado mediante Pointer Lock.
   */
  public isLocked(): boolean {
    return document.pointerLockElement === this.domElement;
  }

  /**
   * Registra un listener para reaccionar a cambios de Pointer Lock.
   */
  public onLockChange(listener: (locked: boolean) => void): () => void {
    this.lockListeners.add(listener);
    return () => {
      this.lockListeners.delete(listener);
    };
  }

  /**
   * Actualiza la orientación y traslación FPS con resolución de colisiones por eje.
   */
  public update(deltaSeconds: number): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    if (!this.isLocked() || deltaSeconds <= 0) {
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

    // Vector frontal proyectado en el plano XZ según yaw actual
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = forwardX * forwardInput + rightX * strafeInput;
    let moveZ = forwardZ * forwardInput + rightZ * strafeInput;

    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    const step = CameraController.MOVE_SPEED * deltaSeconds;
    const nextX = this.camera.position.x + moveX * step;
    const nextZ = this.camera.position.z + moveZ * step;

    // Resolución independiente por eje para deslizamiento suave sobre paredes y muebles
    if (!this.collidesAt(nextX, this.camera.position.z)) {
      this.camera.position.x = nextX;
    }
    if (!this.collidesAt(this.camera.position.x, nextZ)) {
      this.camera.position.z = nextZ;
    }

    this.camera.position.y = CameraController.EYE_HEIGHT;
  }

  /**
   * Libera listeners del DOM al destruir la vista.
   */
  public dispose(): void {
    document.removeEventListener('mousemove', this.handleMouseMoveBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    window.removeEventListener('blur', this.handleWindowBlurBound);
    this.lockListeners.clear();
  }

  private collidesAt(x: number, z: number): boolean {
    const r = CameraController.PLAYER_RADIUS;

    if (
      x - r < -this.roomHalfWidth ||
      x + r > this.roomHalfWidth ||
      z - r < -this.roomHalfDepth ||
      z + r > this.roomHalfDepth
    ) {
      return true;
    }

    for (const box of this.colliders) {
      if (!box.active) {
        continue;
      }

      if (
        x + r > box.minX &&
        x - r < box.maxX &&
        z + r > box.minZ &&
        z - r < box.maxZ
      ) {
        return true;
      }
    }

    return false;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isLocked()) {
      return;
    }

    this.yaw -= event.movementX * CameraController.MOUSE_SENSITIVITY;
    this.pitch -= event.movementY * CameraController.MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch,
      -CameraController.MAX_PITCH_RAD,
      CameraController.MAX_PITCH_RAD
    );
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isLocked()) {
      return;
    }
    this.pressedKeys.add(event.code);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  private onPointerLockChange(): void {
    const locked = this.isLocked();
    if (!locked) {
      this.pressedKeys.clear();
    }
    for (const listener of this.lockListeners) {
      listener(locked);
    }
  }
}
