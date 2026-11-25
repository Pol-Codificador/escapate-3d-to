/**
 * @pattern MVC (Vista — Selector Espacial por Raycasting)
 * @role View Raycast Selector
 *
 * Problema de diseño que resuelve:
 * Lanza un `THREE.Raycaster` desde el centro exacto de la cámara FPS (`(0, 0)`) con
 * alcance limitado (`3.5` m) para detectar el objeto interactivo apuntado y aplicar
 * un resaltado emisivo sutil sobre sus materiales, restaurándolos al dejar de apuntar.
 */

import * as THREE from 'three';
import type { SwitchLeverSymbol } from '../builders3d/RoomMeshFactory';

/**
 * Resultado tipado del raycasting en primera persona.
 */
export interface RaycastTargetHit {
  readonly objectId: string;
  readonly switchSymbol?: SwitchLeverSymbol;
  readonly distance: number;
}

interface SavedMaterialEmissive {
  readonly material: THREE.MeshStandardMaterial;
  readonly emissive: THREE.Color;
  readonly emissiveIntensity: number;
}

/**
 * Selector por raycasting central para objetos interactivos de la escena 3D.
 */
export class RaycastSelector {
  public static readonly MAX_DISTANCE = 3.5;

  private readonly raycaster: THREE.Raycaster;
  private readonly screenCenter: THREE.Vector2;
  private readonly highlightColor: THREE.Color;

  private highlightedGroup: THREE.Group | null;
  private savedEmissives: SavedMaterialEmissive[];
  private currentSelection: RaycastTargetHit | null;

  constructor(highlightHex = 0xff9f43) {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.05;
    this.raycaster.far = RaycastSelector.MAX_DISTANCE;
    this.screenCenter = new THREE.Vector2(0, 0);
    this.highlightColor = new THREE.Color(highlightHex);

    this.highlightedGroup = null;
    this.savedEmissives = [];
    this.currentSelection = null;
  }

  /**
   * Actualiza el color emisivo de resaltado según la paleta temática activa.
   */
  public setHighlightColor(highlightHex: number): void {
    this.highlightColor.setHex(highlightHex);
  }

  /**
   * Ejecuta el raycast desde el centro de cámara contra los grupos interactivos visibles.
   */
  public update(
    camera: THREE.Camera,
    interactiveGroups: Map<string, THREE.Group>
  ): RaycastTargetHit | null {
    const visibleGroups: THREE.Object3D[] = [];
    for (const group of interactiveGroups.values()) {
      if (group.visible) {
        visibleGroups.push(group);
      }
    }

    if (visibleGroups.length === 0) {
      this.clearHighlight();
      this.currentSelection = null;
      return null;
    }

    this.raycaster.setFromCamera(this.screenCenter, camera);
    const intersections = this.raycaster.intersectObjects(visibleGroups, true);

    for (const hit of intersections) {
      const objectId = this.resolveInteractiveObjectId(hit.object);
      if (!objectId) {
        continue;
      }

      const targetGroup = interactiveGroups.get(objectId) ?? null;
      if (!targetGroup || !targetGroup.visible) {
        continue;
      }

      const switchSymbol = this.resolveSwitchSymbol(hit.object);
      const result: RaycastTargetHit = {
        objectId,
        switchSymbol,
        distance: hit.distance,
      };

      if (this.highlightedGroup !== targetGroup) {
        this.clearHighlight();
        this.applyHighlight(targetGroup);
      }

      this.currentSelection = result;
      return result;
    }

    this.clearHighlight();
    this.currentSelection = null;
    return null;
  }

  /**
   * Devuelve la selección más reciente obtenida en el frame actual.
   */
  public getCurrentSelection(): RaycastTargetHit | null {
    return this.currentSelection;
  }

  /**
   * Restaura inmediatamente los materiales del grupo resaltado actualmente.
   */
  public clearHighlight(): void {
    for (const saved of this.savedEmissives) {
      saved.material.emissive.copy(saved.emissive);
      saved.material.emissiveIntensity = saved.emissiveIntensity;
    }
    this.savedEmissives = [];
    this.highlightedGroup = null;
  }

  private applyHighlight(group: THREE.Group): void {
    const visitedMaterials = new Set<THREE.MeshStandardMaterial>();
    const savedList: SavedMaterialEmissive[] = [];

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const mat of materials) {
        if (
          !(mat instanceof THREE.MeshStandardMaterial) ||
          visitedMaterials.has(mat)
        ) {
          continue;
        }
        visitedMaterials.add(mat);
        savedList.push({
          material: mat,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity,
        });

        mat.emissive.lerp(this.highlightColor, 0.45);
        mat.emissiveIntensity = Math.min(1.4, mat.emissiveIntensity + 0.32);
      }
    });

    this.highlightedGroup = group;
    this.savedEmissives = savedList;
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

  private resolveSwitchSymbol(
    object: THREE.Object3D
  ): SwitchLeverSymbol | undefined {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const symbol = cursor.userData.switchSymbol;
      if (symbol === 'A' || symbol === 'B' || symbol === 'C') {
        return symbol;
      }
      cursor = cursor.parent;
    }
    return undefined;
  }
}
