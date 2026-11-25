/**
 * @pattern MVC (Arquitectónico)
 * @role Center-Screen Raycaster & Highlight Selector (Vista 3D)
 *
 * Problema de diseño que resuelve:
 * Lanza un `THREE.Raycaster` desde el centro exacto de la pantalla `(0, 0)` con
 * alcance limitado (`3.5` m) para identificar el `InteractiveObject` apuntado
 * por la mira FPS y aplicar/restaurar un resaltado emisivo sutil sobre sus mallas
 * sin modificar el Modelo.
 */

import * as THREE from 'three';
import type { InteractiveObject } from '../../model/entities/InteractiveObject';
import type { Room } from '../../model/entities/Room';

interface SavedMaterialEmissive {
  readonly emissive: THREE.Color;
  readonly emissiveIntensity: number;
}

/**
 * Selector por raycasting central con resaltado emisivo reversible.
 */
export class RaycastSelector {
  public static readonly MAX_INTERACTION_DISTANCE = 3.5;
  private static readonly CENTER_NDC = new THREE.Vector2(0, 0);

  private readonly raycaster: THREE.Raycaster;
  private interactiveGroups: ReadonlyMap<string, THREE.Group>;
  private room: Room | null;
  private highlightColor: THREE.Color;
  private hoveredObject: InteractiveObject | null;
  private hoveredGroup: THREE.Group | null;
  private readonly savedMaterials: Map<
    THREE.MeshStandardMaterial,
    SavedMaterialEmissive
  >;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = RaycastSelector.MAX_INTERACTION_DISTANCE;
    this.interactiveGroups = new Map<string, THREE.Group>();
    this.room = null;
    this.highlightColor = new THREE.Color(0xff9f43);
    this.hoveredObject = null;
    this.hoveredGroup = null;
    this.savedMaterials = new Map();
  }

  /**
   * Configura los grupos 3D interactivos de la sala actual y el color de resaltado.
   */
  public configure(
    room: Room,
    interactiveGroups: ReadonlyMap<string, THREE.Group>,
    highlightHex: number
  ): void {
    this.clearHighlight();
    this.room = room;
    this.interactiveGroups = interactiveGroups;
    this.highlightColor = new THREE.Color(highlightHex);
  }

  /**
   * Lanza el rayo desde `(0, 0)`, actualiza el resaltado emisivo y devuelve
   * el `InteractiveObject` actualmente apuntado (o `null`).
   */
  public update(camera: THREE.Camera): InteractiveObject | null {
    if (!this.room || this.interactiveGroups.size === 0) {
      this.clearHighlight();
      return null;
    }

    const targets: THREE.Object3D[] = [];
    for (const group of this.interactiveGroups.values()) {
      if (group.visible) {
        targets.push(group);
      }
    }

    this.raycaster.setFromCamera(RaycastSelector.CENTER_NDC, camera);
    const intersections = this.raycaster.intersectObjects(targets, true);

    let matchedObject: InteractiveObject | null = null;
    let matchedGroup: THREE.Group | null = null;

    for (const hit of intersections) {
      const objectId = this.resolveInteractiveObjectId(hit.object);
      if (!objectId) {
        continue;
      }

      const modelObj = this.room.getObject(objectId);
      const group = this.interactiveGroups.get(objectId);
      if (modelObj && modelObj.isVisible && group && group.visible) {
        matchedObject = modelObj;
        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup !== this.hoveredGroup) {
      this.clearHighlight();
      if (matchedGroup && matchedObject) {
        this.applyHighlight(matchedGroup);
        this.hoveredGroup = matchedGroup;
        this.hoveredObject = matchedObject;
      }
    } else if (matchedObject) {
      // Mantiene sincronizada la referencia al objeto del Modelo.
      this.hoveredObject = matchedObject;
    }

    return this.hoveredObject;
  }

  public getHoveredObject(): InteractiveObject | null {
    return this.hoveredObject;
  }

  /**
   * Restaura los materiales emisivos originales del grupo resaltado actual.
   */
  public clearHighlight(): void {
    for (const [material, saved] of this.savedMaterials.entries()) {
      material.emissive.copy(saved.emissive);
      material.emissiveIntensity = saved.emissiveIntensity;
    }
    this.savedMaterials.clear();
    this.hoveredGroup = null;
    this.hoveredObject = null;
  }

  private applyHighlight(group: THREE.Group): void {
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];

      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          continue;
        }
        if (this.savedMaterials.has(material)) {
          continue;
        }

        this.savedMaterials.set(material, {
          emissive: material.emissive.clone(),
          emissiveIntensity: material.emissiveIntensity,
        });

        material.emissive.lerp(this.highlightColor, 0.55);
        material.emissiveIntensity = Math.max(
          material.emissiveIntensity + 0.25,
          0.38
        );
      }
    });
  }

  private resolveInteractiveObjectId(object: THREE.Object3D): string | null {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const id = cursor.userData.interactiveObjectId;
      if (typeof id === 'string' && id.length > 0) {
        return id;
      }
      cursor = cursor.parent;
    }
    return null;
  }
}
