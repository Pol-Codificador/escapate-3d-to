/**
 * @pattern MVC (Vista 3D — Constructor de Escenario Compuesto)
 * @role View 3D Scene Builder
 *
 * Problema de diseño que resuelve:
 * Traduce la entidad pura `Room` del Modelo en una habitación 3D compuesta de `10 × 4 × 10` m
 * con suelo, techo, paredes, molduras y los 6 muebles/objetos interactivos construidos como
 * `THREE.Group` detallados (nunca cajas planas), propagando `userData.interactiveObjectId`,
 * sombras y cajas AABB de colisión en las coordenadas exactas definidas por `RoomDirector`.
 */

import * as THREE from 'three';
import type { ThemeType } from '../../core/interfaces/IThemeFactory';
import type { InteractiveObject } from '../../model/entities/InteractiveObject';
import type { Room } from '../../model/entities/Room';
import { PinCodeStrategy } from '../../model/puzzles/strategies/PinCodeStrategy';
import { ProceduralTextureFactory } from './ProceduralTextureFactory';

/**
 * Símbolo válido de interruptor físico en el panel 3D.
 */
export type SwitchLeverSymbol = 'A' | 'B' | 'C';

/**
 * Referencias animables de un interruptor individual del panel.
 */
export interface SwitchVisualHandles {
  readonly symbol: SwitchLeverSymbol;
  readonly leverPivot: THREE.Group;
  readonly ledMaterial: THREE.MeshStandardMaterial;
}

/**
 * Referencias dinámicas de `clue_wall` (textura UV/holograma y luces dedicadas).
 */
export interface ClueWallVisualHandles {
  readonly panelMesh: THREE.Mesh;
  readonly panelMaterial: THREE.MeshStandardMaterial;
  readonly spotLight: THREE.SpotLight;
  readonly accentPointLight: THREE.PointLight;
  readonly secretPin: string;
}

/**
 * Referencias animables de `safe` (pivote de puerta, teclado y luz interior).
 */
export interface SafeVisualHandles {
  readonly doorPivot: THREE.Group;
  readonly keypadMaterial: THREE.MeshStandardMaterial;
  readonly interiorLight: THREE.PointLight;
  readonly statusLedMaterial: THREE.MeshStandardMaterial;
}

/**
 * Referencias animables de `exit_door` (hojas, indicador luminoso y estilo de apertura).
 */
export interface ExitDoorVisualHandles {
  readonly leftWingPivot: THREE.Group;
  readonly rightWingPivot: THREE.Group;
  readonly statusLightMaterial: THREE.MeshStandardMaterial;
  readonly statusPointLight: THREE.PointLight;
  readonly openMode: 'swing' | 'slide';
}

/**
 * Caja envolvente AABB en el plano horizontal XZ para colisiones del jugador.
 */
export interface ColliderBox2D {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  active: boolean;
}

/**
 * Referencias animables de `desk_box` (tapa pivotante, indicador y luz interior).
 */
export interface DeskBoxVisualHandles {
  readonly lidPivot: THREE.Group;
  readonly lockMat: THREE.MeshStandardMaterial;
  readonly interiorLight: THREE.PointLight;
}

/**
 * Entrada de ítem recolectable en escena para animar flotación y sincronizar visibilidad.
 */
export interface ItemPickupVisualEntry {
  readonly group: THREE.Group;
  readonly baseY: number;
}

/**
 * Conjunto completo de mallas, grupos interactivos, luces y colisionadores generados para una sala.
 */
export interface BuiltRoomSceneAssets {
  readonly rootGroup: THREE.Group;
  readonly interactiveGroups: Map<string, THREE.Group>;
  readonly switchHandles: Map<SwitchLeverSymbol, SwitchVisualHandles>;
  readonly switchStepMaterials: THREE.MeshStandardMaterial[];
  readonly clueWallHandles: ClueWallVisualHandles | null;
  readonly deskBoxHandles: DeskBoxVisualHandles | null;
  readonly safeHandles: SafeVisualHandles | null;
  readonly itemPickupGroups: Map<string, ItemPickupVisualEntry>;
  readonly exitDoorHandles: ExitDoorVisualHandles | null;
  readonly blinkingMaterials: THREE.MeshStandardMaterial[];
  readonly energyCableMaterials: THREE.MeshStandardMaterial[];
  readonly colliders: ColliderBox2D[];
  readonly disposableTextures: THREE.Texture[];
}

/**
 * Constructor compuesto de la geometría 3D procedural de la sala y sus 6 objetos interactivos.
 */
export class RoomMeshFactory {
  private readonly textureFactory: ProceduralTextureFactory;

  constructor(textureFactory = new ProceduralTextureFactory()) {
    this.textureFactory = textureFactory;
  }

  /**
   * Construye la habitación completa y todos sus muebles compuestos a partir de `Room`.
   */
  public buildRoom(room: Room): BuiltRoomSceneAssets {
    const rootGroup = new THREE.Group();
    rootGroup.name = 'room_root';

    const interactiveGroups = new Map<string, THREE.Group>();
    const switchHandles = new Map<SwitchLeverSymbol, SwitchVisualHandles>();
    const switchStepMaterials: THREE.MeshStandardMaterial[] = [];
    const itemPickupGroups = new Map<string, ItemPickupVisualEntry>();
    const blinkingMaterials: THREE.MeshStandardMaterial[] = [];
    const energyCableMaterials: THREE.MeshStandardMaterial[] = [];
    const colliders: ColliderBox2D[] = [];
    const disposableTextures: THREE.Texture[] = [];

    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const secretPin = this.extractSecretPin(room);

    // 1. Estructura arquitectónica de la habitación (10 × 4 × 10 m) y luminarias de techo
    this.buildArchitecture(rootGroup, room, disposableTextures);

    // 2. Decoración temática rica (estantería/estación, alfombra/núcleo, ventanal, racks/butaca, cuadros, cables)
    this.buildThematicDecor(
      rootGroup,
      room,
      disposableTextures,
      colliders,
      blinkingMaterials,
      energyCableMaterials
    );

    // 3. Pedestal fijo bajo la zona del ítem recompensa (x = 3.6, z = 0.45)
    const rewardObj = room.getObject('reward_item_pickup');
    if (rewardObj) {
      this.buildRewardPedestal(
        rootGroup,
        rewardObj.position.x,
        rewardObj.position.z,
        theme,
        palette.furniturePrimary,
        palette.furnitureSecondary,
        disposableTextures,
        colliders
      );
    }

    // 4. Construcción compuesta de los 9 objetos interactivos
    let clueWallHandles: ClueWallVisualHandles | null = null;
    let deskBoxHandles: DeskBoxVisualHandles | null = null;
    let safeHandles: SafeVisualHandles | null = null;
    let exitDoorHandles: ExitDoorVisualHandles | null = null;

    for (const obj of room.getAllObjects()) {
      switch (obj.kind) {
        case 'note': {
          const deskGroup = this.buildDeskWithNote(room, obj, disposableTextures);
          this.registerInteractiveGroup(deskGroup, obj, interactiveGroups, rootGroup);
          colliders.push(this.createColliderFromObject(obj));
          break;
        }
        case 'desk_box': {
          const built = this.buildDeskBox(room, obj, disposableTextures);
          deskBoxHandles = built.handles;
          this.registerInteractiveGroup(built.group, obj, interactiveGroups, rootGroup);
          colliders.push(this.createColliderFromObject(obj));
          break;
        }
        case 'wall_marking': {
          const markingGroup = this.buildWallMarking(room, obj, disposableTextures);
          this.registerInteractiveGroup(markingGroup, obj, interactiveGroups, rootGroup);
          break;
        }
        case 'switch_panel': {
          const { group, levers, stepMaterials } = this.buildSwitchPanel(
            room,
            obj,
            disposableTextures
          );
          for (const lever of levers) {
            switchHandles.set(lever.symbol, lever);
          }
          switchStepMaterials.push(...stepMaterials);
          this.registerInteractiveGroup(group, obj, interactiveGroups, rootGroup);
          break;
        }
        case 'clue_wall': {
          const built = this.buildClueWall(room, obj, secretPin, disposableTextures);
          clueWallHandles = built.handles;
          this.registerInteractiveGroup(built.group, obj, interactiveGroups, rootGroup);
          break;
        }
        case 'safe': {
          const built = this.buildSafe(room, obj, disposableTextures);
          safeHandles = built.handles;
          this.registerInteractiveGroup(built.group, obj, interactiveGroups, rootGroup);
          colliders.push(this.createColliderFromObject(obj));
          break;
        }
        case 'item_pickup': {
          const pickupGroup = this.buildItemPickup(theme, obj);
          pickupGroup.visible = obj.isVisible;
          this.registerInteractiveGroup(pickupGroup, obj, interactiveGroups, rootGroup);
          itemPickupGroups.set(obj.id, {
            group: pickupGroup,
            baseY: obj.position.y,
          });
          break;
        }
        case 'exit_door': {
          const built = this.buildExitDoor(room, obj, disposableTextures);
          exitDoorHandles = built.handles;
          this.registerInteractiveGroup(built.group, obj, interactiveGroups, rootGroup);
          colliders.push({
            ...this.createColliderFromObject(obj),
            active: !room.exitDoor.getIsOpen(),
          });
          break;
        }
      }
    }

    return {
      rootGroup,
      interactiveGroups,
      switchHandles,
      switchStepMaterials,
      clueWallHandles,
      deskBoxHandles,
      safeHandles,
      itemPickupGroups,
      exitDoorHandles,
      blinkingMaterials,
      energyCableMaterials,
      colliders,
      disposableTextures,
    };
  }

  private buildArchitecture(
    rootGroup: THREE.Group,
    room: Room,
    textures: THREE.Texture[]
  ): void {
    const { width, height, depth } = room.dimensions;
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;

    const floorTex = this.textureFactory.createFloorTexture(theme, palette);
    const wallTex = this.textureFactory.createWallTexture(theme, palette);
    const ceilingTex = this.textureFactory.createCeilingTexture(theme, palette);
    textures.push(floorTex, wallTex, ceilingTex);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: theme === 'horror' ? 0.86 : 0.42,
      metalness: theme === 'horror' ? 0.08 : 0.62,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: theme === 'horror' ? 0.88 : 0.45,
      metalness: theme === 'horror' ? 0.06 : 0.52,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTex,
      roughness: theme === 'horror' ? 0.9 : 0.5,
      metalness: theme === 'horror' ? 0.05 : 0.48,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.wallSecondary,
      roughness: theme === 'horror' ? 0.72 : 0.36,
      metalness: theme === 'horror' ? 0.15 : 0.68,
    });

    // Suelo
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    rootGroup.add(floor);

    // Techo
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    ceiling.receiveShadow = true;
    rootGroup.add(ceiling);

    // 4 paredes interiores
    const halfW = width / 2;
    const halfD = depth / 2;
    const walls: Array<{
      w: number;
      h: number;
      pos: [number, number, number];
      rotY: number;
    }> = [
      { w: width, h: height, pos: [0, height / 2, -halfD], rotY: 0 },
      { w: width, h: height, pos: [0, height / 2, halfD], rotY: Math.PI },
      { w: depth, h: height, pos: [-halfW, height / 2, 0], rotY: Math.PI / 2 },
      { w: depth, h: height, pos: [halfW, height / 2, 0], rotY: -Math.PI / 2 },
    ];

    for (const wallSpec of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallSpec.w, wallSpec.h), wallMat);
      wall.position.set(wallSpec.pos[0], wallSpec.pos[1], wallSpec.pos[2]);
      wall.rotation.y = wallSpec.rotY;
      wall.receiveShadow = true;
      rootGroup.add(wall);
    }

    // Pilares de esquina y vigas de techo para dar profundidad arquitectónica
    const pillarGeo = new THREE.BoxGeometry(0.28, height, 0.28);
    for (const [px, pz] of [
      [-halfW + 0.14, -halfD + 0.14],
      [halfW - 0.14, -halfD + 0.14],
      [-halfW + 0.14, halfD - 0.14],
      [halfW - 0.14, halfD - 0.14],
    ]) {
      const pillar = new THREE.Mesh(pillarGeo, trimMat);
      pillar.position.set(px, height / 2, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      rootGroup.add(pillar);
    }

    const beamGeo = new THREE.BoxGeometry(width - 0.3, 0.22, 0.24);
    for (const bz of [-2.4, 0, 2.4]) {
      const beam = new THREE.Mesh(beamGeo, trimMat);
      beam.position.set(0, height - 0.11, bz);
      beam.castShadow = true;
      beam.receiveShadow = true;
      rootGroup.add(beam);
    }

    // Lámpara central colgante del techo (candelabro en horror / tiras LED en scifi)
    if (theme === 'horror') {
      const chandelier = new THREE.Group();
      chandelier.position.set(0, height, 0);

      const ironMat = new THREE.MeshStandardMaterial({
        color: 0x26201c,
        roughness: 0.45,
        metalness: 0.85,
      });
      const candleMat = new THREE.MeshStandardMaterial({
        color: 0xf4ead2,
        roughness: 0.78,
      });
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xffcf70,
        emissive: 0xffa630,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      });

      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10),
        ironMat
      );
      chain.position.y = -0.275;
      chandelier.add(chain);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.028, 10, 24),
        ironMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.58;
      chandelier.add(ring);

      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const cx = Math.cos(angle) * 0.56;
        const cz = Math.sin(angle) * 0.56;

        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, 0.02, 0.025),
          ironMat
        );
        arm.position.set(cx * 0.5, -0.54, cz * 0.5);
        arm.rotation.y = -angle;
        chandelier.add(arm);

        const candle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.028, 0.14, 10),
          candleMat
        );
        candle.position.set(cx, -0.49, cz);
        chandelier.add(candle);

        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 10, 8),
          flameMat
        );
        flame.scale.set(0.8, 1.4, 0.8);
        flame.position.set(cx, -0.4, cz);
        chandelier.add(flame);
      }

      rootGroup.add(chandelier);
    } else {
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0xe6f7ff,
        emissive: 0xb8ecff,
        emissiveIntensity: 1.75,
        roughness: 0.2,
      });
      const housingMat = new THREE.MeshStandardMaterial({
        color: 0x1c2b3b,
        roughness: 0.35,
        metalness: 0.78,
      });

      for (const sx of [-2.3, 0, 2.3]) {
        const housing = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.07, 6.8),
          housingMat
        );
        housing.position.set(sx, height - 0.04, 0);
        rootGroup.add(housing);

        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.03, 6.6),
          stripMat
        );
        strip.position.set(sx, height - 0.075, 0);
        rootGroup.add(strip);
      }
    }
  }

  private buildRewardPedestal(
    rootGroup: THREE.Group,
    x: number,
    z: number,
    theme: ThemeType,
    primaryColor: number,
    secondaryColor: number,
    textures: THREE.Texture[],
    colliders: ColliderBox2D[]
  ): void {
    const tex = this.textureFactory.createSurfaceDetailTexture(theme, primaryColor);
    textures.push(tex);

    const bodyMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: theme === 'horror' ? 0.68 : 0.35,
      metalness: theme === 'horror' ? 0.18 : 0.72,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x6f1d1b : secondaryColor,
      roughness: theme === 'horror' ? 0.85 : 0.25,
      metalness: theme === 'horror' ? 0.05 : 0.65,
      emissive: theme === 'scifi' ? secondaryColor : 0x000000,
      emissiveIntensity: theme === 'scifi' ? 0.2 : 0,
    });

    const pedestal = new THREE.Group();
    pedestal.position.set(x, 0, z);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), bodyMat);
    base.position.y = 0.06;
    pedestal.add(base);

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.64, 0.36), bodyMat);
    column.position.y = 0.44;
    pedestal.add(column);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), bodyMat);
    cap.position.y = 0.8;
    pedestal.add(cap);

    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), trimMat);
    cushion.position.y = 0.86;
    pedestal.add(cushion);

    pedestal.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    rootGroup.add(pedestal);
    colliders.push({
      id: 'reward_pedestal',
      minX: x - 0.3,
      maxX: x + 0.3,
      minZ: z - 0.3,
      maxZ: z + 0.3,
      active: true,
    });
  }

  private buildDeskWithNote(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): THREE.Group {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;

    const surfaceTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    const noteTex = this.textureFactory.createNoteTexture(theme, obj.noteContent ?? '');
    textures.push(surfaceTex, noteTex);

    const woodOrMetalMat = new THREE.MeshStandardMaterial({
      map: surfaceTex,
      roughness: theme === 'horror' ? 0.72 : 0.38,
      metalness: theme === 'horror' ? 0.12 : 0.68,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.32,
      metalness: 0.78,
    });
    const noteMat = new THREE.MeshStandardMaterial({
      map: noteTex,
      roughness: theme === 'horror' ? 0.85 : 0.25,
      metalness: theme === 'horror' ? 0.02 : 0.2,
      emissive: theme === 'scifi' ? 0x004466 : 0x000000,
      emissiveIntensity: theme === 'scifi' ? 0.45 : 0,
    });

    const group = new THREE.Group();
    const legH = h - 0.08;

    // Tablero principal y moldura inferior
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), woodOrMetalMat);
    top.position.y = h - 0.04;
    group.add(top);

    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.14, 0.14, d - 0.14),
      woodOrMetalMat
    );
    apron.position.y = h - 0.15;
    group.add(apron);

    // 4 patas detalladas con zapatas metálicas
    const legOffsets: Array<[number, number]> = [
      [-w / 2 + 0.1, -d / 2 + 0.1],
      [w / 2 - 0.1, -d / 2 + 0.1],
      [-w / 2 + 0.1, d / 2 - 0.1],
      [w / 2 - 0.1, d / 2 - 0.1],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, legH, 0.09), woodOrMetalMat);
      leg.position.set(lx, legH / 2, lz);
      group.add(leg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.11), accentMat);
      foot.position.set(lx, 0.025, lz);
      group.add(foot);
    }

    // Cajón frontal + tirador
    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.45, 0.12, 0.04),
      woodOrMetalMat
    );
    drawer.position.set(0, h - 0.16, d / 2 - 0.05);
    group.add(drawer);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 10), accentMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, h - 0.16, d / 2 - 0.015);
    group.add(handle);

    // Lámpara pequeña sobre el escritorio
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 14), accentMat);
    lampBase.position.set(-w * 0.34, h + 0.02, -d * 0.22);
    group.add(lampBase);

    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.26, 10), accentMat);
    lampStem.position.set(-w * 0.34, h + 0.16, -d * 0.22);
    group.add(lampStem);

    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x2f5233 : 0x0d3b66,
      emissive: theme === 'horror' ? 0xffb36b : 0x00d2ff,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.14, 16),
      lampShadeMat
    );
    lampShade.position.set(-w * 0.34, h + 0.3, -d * 0.22);
    group.add(lampShade);

    const deskLight = new THREE.PointLight(
      theme === 'horror' ? 0xffb36b : 0x64dfdf,
      0.55,
      2.6,
      2
    );
    deskLight.position.set(-w * 0.3, h + 0.24, -d * 0.16);
    group.add(deskLight);

    // Nota legible / Datapad sobre el tablero
    const noteSheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.018, 0.52),
      noteMat
    );
    noteSheet.position.set(0.08, h + 0.01, 0.04);
    noteSheet.rotation.y = -0.14;
    group.add(noteSheet);

    return group;
  }

  private buildSwitchPanel(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): {
    group: THREE.Group;
    levers: SwitchVisualHandles[];
    stepMaterials: THREE.MeshStandardMaterial[];
  } {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;

    const surfaceTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    textures.push(surfaceTex);

    const frameMat = new THREE.MeshStandardMaterial({
      map: surfaceTex,
      roughness: theme === 'horror' ? 0.65 : 0.32,
      metalness: theme === 'horror' ? 0.45 : 0.78,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x1e1916 : 0x101c28,
      roughness: 0.55,
      metalness: 0.55,
    });
    const metalAccentMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.35,
      metalness: 0.85,
    });

    const group = new THREE.Group();

    // Gabinete principal y marco
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    group.add(cabinet);

    const innerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.1, h - 0.12, 0.04),
      plateMat
    );
    innerPlate.position.z = d / 2 - 0.01;
    group.add(innerPlate);

    // 5 indicadores LED superiores de secuencia (1..5)
    const stepMaterials: THREE.MeshStandardMaterial[] = [];
    for (let s = 0; s < 5; s += 1) {
      const stepMat = new THREE.MeshStandardMaterial({
        color: 0x262a30,
        emissive: 0x000000,
        emissiveIntensity: 0.2,
        roughness: 0.3,
      });
      const stepLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.045, 0.025),
        stepMat
      );
      stepLed.position.set((s - 2) * 0.11, h / 2 - 0.11, d / 2 + 0.015);
      group.add(stepLed);
      stepMaterials.push(stepMat);
    }

    // Conductos superior e inferior
    const conduitGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.65, 10);
    for (const cx of [-0.18, 0.18]) {
      const conduit = new THREE.Mesh(conduitGeo, metalAccentMat);
      conduit.position.set(cx, h / 2 + 0.3, 0);
      group.add(conduit);
    }

    const levers: SwitchVisualHandles[] = [];
    const symbols: SwitchLeverSymbol[] = ['A', 'B', 'C'];
    const spacing = 0.2;

    for (let i = 0; i < symbols.length; i += 1) {
      const symbol = symbols[i];
      const xOffset = (i - 1) * spacing;

      const switchModule = new THREE.Group();
      switchModule.position.set(xOffset, -0.05, d / 2 + 0.015);
      switchModule.userData.switchSymbol = symbol;

      const labelTex = this.textureFactory.createSwitchLabelTexture(symbol, theme);
      textures.push(labelTex);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.13),
        new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.45 })
      );
      labelMesh.position.set(0, -0.24, 0.015);
      labelMesh.userData.switchSymbol = symbol;
      switchModule.add(labelMesh);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x3b1818,
        emissive: 0xaa2222,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), ledMat);
      led.position.set(0, 0.22, 0.02);
      led.userData.switchSymbol = symbol;
      switchModule.add(led);

      const socket = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.22, 0.04),
        metalAccentMat
      );
      socket.userData.switchSymbol = symbol;
      switchModule.add(socket);

      // Pivote de palanca (arriba = desactivado -0.45 rad, abajo = activado +0.45 rad)
      const leverPivot = new THREE.Group();
      leverPivot.position.set(0, 0, 0.02);
      leverPivot.rotation.x = -0.45;

      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.14, 10),
        metalAccentMat
      );
      arm.rotation.x = Math.PI / 2;
      arm.position.z = 0.07;
      arm.userData.switchSymbol = symbol;
      leverPivot.add(arm);

      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 12, 10),
        new THREE.MeshStandardMaterial({
          color: theme === 'horror' ? 0x8b2626 : 0x00a8cc,
          roughness: 0.35,
          metalness: 0.3,
        })
      );
      knob.position.z = 0.14;
      knob.userData.switchSymbol = symbol;
      leverPivot.add(knob);

      switchModule.add(leverPivot);
      group.add(switchModule);

      levers.push({
        symbol,
        leverPivot,
        ledMaterial: ledMat,
      });
    }

    return { group, levers, stepMaterials };
  }

  private buildClueWall(
    room: Room,
    obj: InteractiveObject,
    secretPin: string,
    textures: THREE.Texture[]
  ): { group: THREE.Group; handles: ClueWallVisualHandles } {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;
    const isRevealed = obj.isActivated && !obj.isLocked;

    const frameTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furnitureSecondary
    );
    const clueTex = this.textureFactory.createClueWallTexture(
      theme,
      secretPin,
      isRevealed
    );
    textures.push(frameTex, clueTex);

    const frameMat = new THREE.MeshStandardMaterial({
      map: frameTex,
      roughness: theme === 'horror' ? 0.55 : 0.3,
      metalness: theme === 'horror' ? 0.42 : 0.8,
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      map: clueTex,
      roughness: theme === 'horror' ? 0.78 : 0.22,
      metalness: theme === 'horror' ? 0.05 : 0.35,
      emissive: isRevealed
        ? theme === 'horror'
          ? 0x7b2cbf
          : 0x00f5d4
        : 0x000000,
      emissiveIntensity: isRevealed ? 0.65 : 0,
      emissiveMap: clueTex,
    });

    const group = new THREE.Group();

    // Base trasera del marco
    const backing = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.5), frameMat);
    backing.position.z = -d * 0.25;
    group.add(backing);

    // Cuatro listones de marco perimetral
    const borderT = 0.09;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(w, borderT, d), frameMat);
    topBar.position.y = h / 2 - borderT / 2;
    group.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(w, borderT, d), frameMat);
    bottomBar.position.y = -h / 2 + borderT / 2;
    group.add(bottomBar);

    const leftBar = new THREE.Mesh(
      new THREE.BoxGeometry(borderT, h - borderT * 2, d),
      frameMat
    );
    leftBar.position.x = -w / 2 + borderT / 2;
    group.add(leftBar);

    const rightBar = new THREE.Mesh(
      new THREE.BoxGeometry(borderT, h - borderT * 2, d),
      frameMat
    );
    rightBar.position.x = w / 2 - borderT / 2;
    group.add(rightBar);

    // Lienzo o pantalla holográfica central
    const panelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w - borderT * 2, h - borderT * 2),
      panelMaterial
    );
    panelMesh.position.z = d * 0.15;
    group.add(panelMesh);

    // Foco superior (lámpara UV en horror / emisor holográfico en scifi)
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 0.22),
      frameMat
    );
    hood.position.set(0, h / 2 + 0.1, 0.16);
    group.add(hood);

    const lightColor = theme === 'horror' ? 0x9d4edd : 0x00f5d4;
    const spotLight = new THREE.SpotLight(
      lightColor,
      isRevealed ? 3.5 : 0,
      4.5,
      Math.PI / 4,
      0.55,
      1.5
    );
    spotLight.position.set(0, h / 2 + 0.05, 0.55);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0.08);
    group.add(spotTarget);
    spotLight.target = spotTarget;
    group.add(spotLight);

    const accentPointLight = new THREE.PointLight(
      lightColor,
      isRevealed ? 1.15 : 0,
      3.0,
      2
    );
    accentPointLight.position.set(0, 0, 0.42);
    group.add(accentPointLight);

    return {
      group,
      handles: {
        panelMesh,
        panelMaterial,
        spotLight,
        accentPointLight,
        secretPin,
      },
    };
  }

  private buildSafe(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): { group: THREE.Group; handles: SafeVisualHandles } {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;
    const wallT = 0.07;

    const bodyTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    const keypadTex = this.textureFactory.createKeypadTexture(theme, !obj.isLocked);
    textures.push(bodyTex, keypadTex);

    const bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTex,
      roughness: theme === 'horror' ? 0.55 : 0.28,
      metalness: theme === 'horror' ? 0.72 : 0.82,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.28,
      metalness: 0.88,
    });
    const keypadMaterial = new THREE.MeshStandardMaterial({
      map: keypadTex,
      roughness: 0.35,
      metalness: 0.25,
      emissive: theme === 'scifi' ? 0x004e64 : 0x000000,
      emissiveIntensity: theme === 'scifi' ? 0.4 : 0,
    });
    const statusLedMaterial = new THREE.MeshStandardMaterial({
      color: obj.isLocked ? 0xaa2222 : 0x22cc66,
      emissive: obj.isLocked ? 0xdd2222 : 0x22ee77,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });

    const group = new THREE.Group();

    // Cuerpo hueco de 5 caras para que al abrir la puerta se vea el interior
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), bodyMat);
    bottom.position.y = wallT / 2;
    group.add(bottom);

    const top = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), bodyMat);
    top.position.y = h - wallT / 2;
    group.add(top);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(w, h - wallT * 2, wallT),
      bodyMat
    );
    back.position.set(0, h / 2, -d / 2 + wallT / 2);
    group.add(back);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, h - wallT * 2, d - wallT),
      bodyMat
    );
    leftWall.position.set(-w / 2 + wallT / 2, h / 2, wallT / 2);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, h - wallT * 2, d - wallT),
      bodyMat
    );
    rightWall.position.set(w / 2 - wallT / 2, h / 2, wallT / 2);
    group.add(rightWall);

    // Repisa interior y luz interna
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(w - wallT * 2.2, 0.04, d - wallT * 2),
      accentMat
    );
    shelf.position.set(0, h * 0.48, 0);
    group.add(shelf);

    const interiorLight = new THREE.PointLight(
      theme === 'horror' ? 0xffb36b : 0x00f5d4,
      obj.isLocked ? 0 : 1.1,
      2.2,
      2
    );
    interiorLight.position.set(0, h * 0.72, 0.05);
    group.add(interiorLight);

    // Bisagras en el borde frontal izquierdo
    for (const hy of [h * 0.24, h * 0.76]) {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10),
        accentMat
      );
      hinge.position.set(-w / 2 + wallT * 0.6, hy, d / 2);
      group.add(hinge);
    }

    // Subgrupo pivote para puerta (gira -105 grados hacia afuera +Z al abrir)
    const doorWidth = w - wallT * 1.4;
    const doorHeight = h - wallT * 1.4;
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-w / 2 + wallT * 0.7, h / 2, d / 2 - 0.02);
    if (!obj.isLocked && obj.isActivated) {
      doorPivot.rotation.y = -THREE.MathUtils.degToRad(105);
    }

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, doorHeight, 0.06),
      bodyMat
    );
    doorPanel.position.set(doorWidth / 2, 0, 0);
    doorPivot.add(doorPanel);

    // Teclado numérico sobre la puerta
    const keypad = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.34, 0.025),
      keypadMaterial
    );
    keypad.position.set(doorWidth * 0.62, 0.14, 0.036);
    doorPivot.add(keypad);

    // LED de estado
    const statusLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 10),
      statusLedMaterial
    );
    statusLed.position.set(doorWidth * 0.62, 0.36, 0.04);
    doorPivot.add(statusLed);

    // Manivela / volante de cierre
    const wheelHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12),
      accentMat
    );
    wheelHub.rotation.x = Math.PI / 2;
    wheelHub.position.set(doorWidth * 0.28, -0.05, 0.055);
    doorPivot.add(wheelHub);

    const wheelRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.018, 10, 20),
      accentMat
    );
    wheelRing.position.set(doorWidth * 0.28, -0.05, 0.085);
    doorPivot.add(wheelRing);

    group.add(doorPivot);

    return {
      group,
      handles: {
        doorPivot,
        keypadMaterial,
        interiorLight,
        statusLedMaterial,
      },
    };
  }

  private buildDeskBox(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): { group: THREE.Group; handles: DeskBoxVisualHandles } {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;

    const surfaceTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    const noteTex = this.textureFactory.createDeskBoxNoteTexture(theme);
    textures.push(surfaceTex, noteTex);

    const bodyMat = new THREE.MeshStandardMaterial({
      map: surfaceTex,
      roughness: theme === 'horror' ? 0.68 : 0.34,
      metalness: theme === 'horror' ? 0.16 : 0.72,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.3,
      metalness: 0.85,
    });
    const lockMat = new THREE.MeshStandardMaterial({
      color: obj.isLocked ? 0xaa2222 : 0x22cc66,
      emissive: obj.isLocked ? 0xcc2222 : 0x22ff88,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    });
    const innerNoteMat = new THREE.MeshStandardMaterial({
      map: noteTex,
      roughness: theme === 'horror' ? 0.8 : 0.25,
      emissive: theme === 'scifi' ? 0x004e64 : 0x000000,
      emissiveIntensity: theme === 'scifi' ? 0.5 : 0,
    });

    const group = new THREE.Group();

    const standH = 0.72;
    const topStand = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), bodyMat);
    topStand.position.y = standH - 0.03;
    group.add(topStand);

    for (const [lx, lz] of [
      [-w / 2 + 0.08, -d / 2 + 0.08],
      [w / 2 - 0.08, -d / 2 + 0.08],
      [-w / 2 + 0.08, d / 2 - 0.08],
      [w / 2 - 0.08, d / 2 - 0.08],
    ]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, standH - 0.06, 0.07),
        bodyMat
      );
      leg.position.set(lx, (standH - 0.06) / 2, lz);
      group.add(leg);
    }

    const boxW = w - 0.12;
    const boxD = d - 0.1;
    const boxH = h - standH - 0.04;
    const wallT = 0.032;
    const boxBaseY = standH;

    const floorPlate = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, wallT, boxD),
      bodyMat
    );
    floorPlate.position.y = boxBaseY + wallT / 2;
    group.add(floorPlate);

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, wallT),
      bodyMat
    );
    frontWall.position.set(0, boxBaseY + boxH / 2, boxD / 2 - wallT / 2);
    group.add(frontWall);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, wallT),
      bodyMat
    );
    backWall.position.set(0, boxBaseY + boxH / 2, -boxD / 2 + wallT / 2);
    group.add(backWall);

    const sideLeft = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, boxH, boxD - wallT * 2),
      bodyMat
    );
    sideLeft.position.set(-boxW / 2 + wallT / 2, boxBaseY + boxH / 2, 0);
    group.add(sideLeft);

    const sideRight = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, boxH, boxD - wallT * 2),
      bodyMat
    );
    sideRight.position.set(boxW / 2 - wallT / 2, boxBaseY + boxH / 2, 0);
    group.add(sideRight);

    const innerNote = new THREE.Mesh(
      new THREE.BoxGeometry(boxW * 0.68, 0.012, boxD * 0.68),
      innerNoteMat
    );
    innerNote.position.set(0, boxBaseY + wallT + 0.01, 0);
    group.add(innerNote);

    const interiorLight = new THREE.PointLight(
      theme === 'horror' ? 0xffbe76 : 0x00f5d4,
      obj.isLocked ? 0 : 1.0,
      2.0,
      2
    );
    interiorLight.position.set(0, boxBaseY + boxH + 0.12, 0);
    group.add(interiorLight);

    const lockPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.1, 0.028),
      trimMat
    );
    lockPlate.position.set(0, boxBaseY + boxH * 0.72, boxD / 2 + 0.012);
    group.add(lockPlate);

    const lockIndicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 10),
      lockMat
    );
    lockIndicator.position.set(0, boxBaseY + boxH * 0.72, boxD / 2 + 0.028);
    group.add(lockIndicator);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, boxBaseY + boxH, -boxD / 2 + 0.015);
    if (!obj.isLocked && obj.isActivated) {
      lidPivot.rotation.x = -THREE.MathUtils.degToRad(100);
    }

    const lidMesh = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.02, 0.045, boxD + 0.02),
      bodyMat
    );
    lidMesh.position.set(0, 0.022, boxD / 2 - 0.015);
    lidPivot.add(lidMesh);

    const lidTrim = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.03, 0.016, 0.05),
      trimMat
    );
    lidTrim.position.set(0, 0.045, boxD - 0.04);
    lidPivot.add(lidTrim);

    group.add(lidPivot);

    return {
      group,
      handles: {
        lidPivot,
        lockMat,
        interiorLight,
      },
    };
  }

  private buildWallMarking(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): THREE.Group {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;

    const markTex = this.textureFactory.createWallMarkingTexture(theme);
    textures.push(markTex);

    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: palette.wallSecondary,
      roughness: theme === 'horror' ? 0.75 : 0.35,
      metalness: theme === 'horror' ? 0.2 : 0.75,
    });
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: markTex,
      roughness: theme === 'horror' ? 0.85 : 0.28,
      metalness: theme === 'horror' ? 0.05 : 0.3,
      emissive: theme === 'scifi' ? 0x004e64 : 0x260808,
      emissiveIntensity: theme === 'scifi' ? 0.35 : 0.15,
    });

    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d * 0.4),
      frameMat
    );
    backing.position.z = -d * 0.2;
    group.add(backing);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.08, h - 0.08),
      plaqueMat
    );
    face.position.z = d * 0.12;
    group.add(face);

    const sconceGlowMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0xffb36b : 0x00f5d4,
      emissive: theme === 'horror' ? 0xff9f43 : 0x00f5d4,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    for (const sx of [-w / 2 - 0.14, w / 2 + 0.14]) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.22, 0.1),
        frameMat
      );
      bracket.position.set(sx, 0, 0.04);
      group.add(bracket);

      const emitter = new THREE.Mesh(
        theme === 'horror'
          ? new THREE.SphereGeometry(0.04, 10, 8)
          : new THREE.BoxGeometry(0.04, 0.2, 0.04),
        sconceGlowMat
      );
      emitter.position.set(sx, theme === 'horror' ? 0.14 : 0, 0.09);
      group.add(emitter);
    }

    return group;
  }

  private buildThematicDecor(
    rootGroup: THREE.Group,
    room: Room,
    textures: THREE.Texture[],
    colliders: ColliderBox2D[],
    blinkingMaterials: THREE.MeshStandardMaterial[],
    energyCableMaterials: THREE.MeshStandardMaterial[]
  ): void {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;

    const woodOrMetalTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    const rugTex = this.textureFactory.createRugOrDeckTexture(theme, palette);
    const windowTex = this.textureFactory.createWindowBackdropTexture(theme);
    textures.push(woodOrMetalTex, rugTex, windowTex);

    const primaryMat = new THREE.MeshStandardMaterial({
      map: woodOrMetalTex,
      roughness: theme === 'horror' ? 0.72 : 0.36,
      metalness: theme === 'horror' ? 0.14 : 0.74,
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.32,
      metalness: 0.82,
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: palette.wallSecondary,
      roughness: theme === 'horror' ? 0.75 : 0.4,
      metalness: theme === 'horror' ? 0.2 : 0.68,
    });

    const centerMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      roughness: theme === 'horror' ? 0.92 : 0.42,
      metalness: theme === 'horror' ? 0.04 : 0.55,
    });
    const centerFloorAccent = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 4.7),
      centerMat
    );
    centerFloorAccent.rotation.x = -Math.PI / 2;
    centerFloorAccent.position.set(0, 0.008, 0.1);
    centerFloorAccent.receiveShadow = true;
    rootGroup.add(centerFloorAccent);

    const windowGroup = new THREE.Group();
    windowGroup.position.set(-4.94, 2.08, 0.22);
    windowGroup.rotation.y = Math.PI / 2;

    const glassMat = new THREE.MeshStandardMaterial({
      map: windowTex,
      emissiveMap: windowTex,
      emissive: theme === 'horror' ? 0x6ea8fe : 0x48bfe3,
      emissiveIntensity: theme === 'horror' ? 0.75 : 0.9,
      roughness: 0.15,
    });
    const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), glassMat);
    windowGroup.add(windowPane);

    for (const [fx, fy, fw, fh] of [
      [0, 0.98, 1.66, 0.12],
      [0, -0.98, 1.66, 0.12],
      [-0.78, 0, 0.12, 2.0],
      [0.78, 0, 0.12, 2.0],
    ] as Array<[number, number, number, number]>) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(fw, fh, 0.1),
        darkTrimMat
      );
      bar.position.set(fx, fy, 0.04);
      windowGroup.add(bar);
    }

    if (theme === 'horror') {
      for (const bx of [-0.42, 0, 0.42]) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.9, 8),
          secondaryMat
        );
        rod.position.set(bx, 0, 0.06);
        windowGroup.add(rod);
      }
      const curtainMat = new THREE.MeshStandardMaterial({
        color: 0x3b1216,
        roughness: 0.9,
      });
      for (const cx of [-0.94, 0.94]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 2.35, 0.12),
          curtainMat
        );
        curtain.position.set(cx, -0.08, 0.08);
        windowGroup.add(curtain);
      }
    } else {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.08, 0.08),
        secondaryMat
      );
      divider.position.set(0, 0.1, 0.05);
      windowGroup.add(divider);
    }
    rootGroup.add(windowGroup);

    this.buildNorthwestStation(
      rootGroup,
      theme,
      primaryMat,
      secondaryMat,
      colliders
    );

    const artPlacements: Array<{ pos: [number, number, number]; rotY: number; v: number }> = [
      { pos: [-1.7, 2.1, -4.92], rotY: 0, v: 0 },
      { pos: [1.7, 2.1, -4.92], rotY: 0, v: 1 },
      { pos: [4.92, 2.1, 0.45], rotY: -Math.PI / 2, v: 0 },
      { pos: [-2.4, 2.1, 4.92], rotY: Math.PI, v: 1 },
      { pos: [2.4, 2.1, 4.92], rotY: Math.PI, v: 0 },
    ];
    for (const art of artPlacements) {
      const artTex = this.textureFactory.createDecorWallArtTexture(theme, art.v);
      textures.push(artTex);
      const artGroup = new THREE.Group();
      artGroup.position.set(art.pos[0], art.pos[1], art.pos[2]);
      artGroup.rotation.y = art.rotY;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 1.04, 0.05),
        darkTrimMat
      );
      artGroup.add(frame);

      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.92),
        new THREE.MeshStandardMaterial({
          map: artTex,
          roughness: theme === 'horror' ? 0.78 : 0.3,
          emissive: theme === 'scifi' ? 0x004e64 : 0x000000,
          emissiveIntensity: theme === 'scifi' ? 0.35 : 0,
        })
      );
      canvasMesh.position.z = 0.03;
      artGroup.add(canvasMesh);
      rootGroup.add(artGroup);
    }

    if (theme === 'horror') {
      this.buildHorrorSecondaryProps(rootGroup, primaryMat, secondaryMat, colliders);
    } else {
      this.buildSciFiSecondaryProps(
        rootGroup,
        room,
        primaryMat,
        secondaryMat,
        colliders,
        blinkingMaterials,
        energyCableMaterials
      );
    }
  }

  private buildNorthwestStation(
    rootGroup: THREE.Group,
    theme: ThemeType,
    primaryMat: THREE.MeshStandardMaterial,
    secondaryMat: THREE.MeshStandardMaterial,
    colliders: ColliderBox2D[]
  ): void {
    const station = new THREE.Group();
    station.position.set(-3.2, 0, -4.52);

    const w = 1.5;
    const h = 2.45;
    const d = 0.54;

    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), primaryMat);
    back.position.set(0, h / 2, -d / 2 + 0.025);
    station.add(back);

    for (const sx of [-w / 2 + 0.04, w / 2 - 0.04]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), primaryMat);
      side.position.set(sx, h / 2, 0);
      station.add(side);
    }

    for (const sy of [0.18, 1.07, 1.78, h - 0.05]) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.08, 0.06, d),
        primaryMat
      );
      shelf.position.set(0, sy, 0);
      station.add(shelf);
    }

    if (theme === 'horror') {
      const bookColors = [0x6b1d1d, 0x1d4e3e, 0x3b2b52, 0x734b26, 0x263849];
      for (const rowY of [0.21, 1.81]) {
        for (let b = 0; b < 9; b += 1) {
          if (b === 4) continue;
          const bh = 0.24 + (b % 3) * 0.04;
          const bookMat = new THREE.MeshStandardMaterial({
            color: bookColors[b % bookColors.length],
            roughness: 0.78,
          });
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, bh, 0.28),
            bookMat
          );
          book.position.set(-0.56 + b * 0.14, rowY + bh / 2, 0.04);
          station.add(book);
        }
      }

      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.038, 0.16, 10),
        new THREE.MeshStandardMaterial({ color: 0xf4ead2, roughness: 0.75 })
      );
      candle.position.set(0.46, 1.18, 0.12);
      station.add(candle);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffd166,
          emissive: 0xff9f1c,
          emissiveIntensity: 2.0,
        })
      );
      flame.position.set(0.46, 1.28, 0.12);
      station.add(flame);
    } else {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.03, 0.36),
        new THREE.MeshStandardMaterial({
          color: 0x0b2a3c,
          emissive: 0x00d2ff,
          emissiveIntensity: 0.5,
          roughness: 0.25,
        })
      );
      pad.position.set(0, 1.11, 0.16);
      station.add(pad);

      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.24, 0.04, 0.04),
        new THREE.MeshStandardMaterial({
          color: 0x72efdd,
          emissive: 0x00f5d4,
          emissiveIntensity: 1.4,
        })
      );
      ledBar.position.set(0, 2.34, 0.18);
      station.add(ledBar);

      for (const tx of [-0.42, 0.38]) {
        const caseMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.22, 0.32),
          secondaryMat
        );
        caseMesh.position.set(tx, 1.92, 0.04);
        station.add(caseMesh);
      }
    }

    station.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    rootGroup.add(station);

    colliders.push({
      id: 'northwest_station',
      minX: -3.98,
      maxX: -2.42,
      minZ: -4.9,
      maxZ: -4.16,
      active: true,
    });
  }

  private buildHorrorSecondaryProps(
    rootGroup: THREE.Group,
    primaryMat: THREE.MeshStandardMaterial,
    secondaryMat: THREE.MeshStandardMaterial,
    colliders: ColliderBox2D[]
  ): void {
    const lounge = new THREE.Group();
    lounge.position.set(3.2, 0, -4.25);

    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x5c1a22,
      roughness: 0.85,
    });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.78), velvetMat);
    seat.position.set(-0.34, 0.28, 0);
    lounge.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.72, 0.18), velvetMat);
    backrest.position.set(-0.34, 0.78, -0.3);
    lounge.add(backrest);

    for (const ax of [-0.71, 0.03]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.74), velvetMat);
      arm.position.set(ax, 0.56, 0);
      lounge.add(arm);
    }

    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16),
      primaryMat
    );
    tableTop.position.set(0.54, 0.64, 0.08);
    lounge.add(tableTop);

    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.14, 0.62, 12),
      primaryMat
    );
    tableLeg.position.set(0.54, 0.31, 0.08);
    lounge.add(tableLeg);

    const candleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.06, 12),
      secondaryMat
    );
    candleBase.position.set(0.54, 0.69, 0.08);
    lounge.add(candleBase);

    const candleStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0xf4ead2, roughness: 0.8 })
    );
    candleStick.position.set(0.54, 0.81, 0.08);
    lounge.add(candleStick);

    const candleFlame = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff9f1c,
        emissiveIntensity: 2.0,
      })
    );
    candleFlame.position.set(0.54, 0.92, 0.08);
    lounge.add(candleFlame);

    lounge.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    rootGroup.add(lounge);
    colliders.push({
      id: 'horror_lounge',
      minX: 2.38,
      maxX: 4.1,
      minZ: -4.85,
      maxZ: -3.72,
      active: true,
    });

    const trunk = new THREE.Group();
    trunk.position.set(4.3, 0, 3.85);
    trunk.rotation.y = -Math.PI / 5;

    const trunkBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, 0.56), primaryMat);
    trunkBox.position.y = 0.25;
    trunk.add(trunkBox);

    const trunkLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.92, 12, 1, false, 0, Math.PI),
      primaryMat
    );
    trunkLid.rotation.z = Math.PI / 2;
    trunkLid.position.y = 0.5;
    trunk.add(trunkLid);

    for (const bx of [-0.32, 0.32]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.54, 0.58), secondaryMat);
      strap.position.set(bx, 0.27, 0);
      trunk.add(strap);
    }

    trunk.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    rootGroup.add(trunk);
    colliders.push({
      id: 'horror_trunk',
      minX: 3.72,
      maxX: 4.88,
      minZ: 3.3,
      maxZ: 4.4,
      active: true,
    });

    const webMat = new THREE.MeshStandardMaterial({
      color: 0xbcb8b1,
      transparent: true,
      opacity: 0.28,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    for (const [wx, wz, rot] of [
      [-4.6, -4.6, Math.PI / 4],
      [4.6, -4.6, -Math.PI / 4],
      [4.6, 4.6, (-3 * Math.PI) / 4],
      [-4.6, 4.6, (3 * Math.PI) / 4],
    ] as Array<[number, number, number]>) {
      const web = new THREE.Mesh(new THREE.CircleGeometry(0.75, 7, 0, Math.PI / 2), webMat);
      web.position.set(wx, 3.78, wz);
      web.rotation.x = Math.PI / 2.6;
      web.rotation.z = rot;
      rootGroup.add(web);
    }
  }

  private buildSciFiSecondaryProps(
    rootGroup: THREE.Group,
    room: Room,
    primaryMat: THREE.MeshStandardMaterial,
    secondaryMat: THREE.MeshStandardMaterial,
    colliders: ColliderBox2D[],
    blinkingMaterials: THREE.MeshStandardMaterial[],
    energyCableMaterials: THREE.MeshStandardMaterial[]
  ): void {
    const racks = new THREE.Group();
    racks.position.set(3.2, 0, -4.48);

    const rackBodyMat = new THREE.MeshStandardMaterial({
      color: 0x162230,
      roughness: 0.34,
      metalness: 0.78,
    });

    for (const rx of [-0.42, 0.42]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.74, 2.55, 0.62), rackBodyMat);
      tower.position.set(rx, 1.275, 0);
      racks.add(tower);

      for (let row = 0; row < 5; row += 1) {
        const isAmber = (row + (rx > 0 ? 1 : 0)) % 2 === 0;
        const ledMat = new THREE.MeshStandardMaterial({
          color: isAmber ? 0xf4a261 : 0x00f5d4,
          emissive: isAmber ? 0xff9f1c : 0x00f5d4,
          emissiveIntensity: 1.1,
          roughness: 0.2,
        });
        blinkingMaterials.push(ledMat);

        const ledStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.04, 0.03),
          ledMat
        );
        ledStrip.position.set(rx, 0.45 + row * 0.42, 0.31);
        racks.add(ledStrip);
      }
    }

    racks.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    rootGroup.add(racks);
    colliders.push({
      id: 'scifi_racks',
      minX: 2.38,
      maxX: 4.02,
      minZ: -4.85,
      maxZ: -4.05,
      active: true,
    });

    const cargo = new THREE.Group();
    cargo.position.set(4.25, 0, 3.85);

    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.7, 0.78), primaryMat);
    crate1.position.y = 0.35;
    cargo.add(crate1);

    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xe9c46a,
      roughness: 0.4,
      metalness: 0.3,
    });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.8), stripeMat);
    stripe.position.y = 0.54;
    cargo.add(stripe);

    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.52), secondaryMat);
    crate2.position.set(-0.08, 0.93, -0.05);
    crate2.rotation.y = 0.28;
    cargo.add(crate2);

    cargo.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    rootGroup.add(cargo);
    colliders.push({
      id: 'scifi_cargo',
      minX: 3.72,
      maxX: 4.82,
      minZ: 3.38,
      maxZ: 4.32,
      active: true,
    });

    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x3b526b,
      roughness: 0.32,
      metalness: 0.85,
    });
    for (const px of [-4.86, 4.86]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 9.6, 12),
        pipeMat
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(px, 3.52, 0);
      rootGroup.add(pipe);
    }

    const seqSolved = Boolean(room.getPuzzle('sequence_puzzle')?.getIsSolved());
    const cableMat = new THREE.MeshStandardMaterial({
      color: seqSolved ? 0x00f5d4 : 0x1e3a4c,
      emissive: seqSolved ? 0x00f5d4 : 0x004e64,
      emissiveIntensity: seqSolved ? 1.5 : 0.35,
      roughness: 0.25,
    });
    energyCableMaterials.push(cableMat);

    const cableSegments: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [
      { pos: [-4.88, 2.95, -1.8], size: [0.05, 1.9, 0.06] },
      { pos: [0, 3.88, -1.8], size: [9.76, 0.05, 0.06] },
      { pos: [4.88, 2.95, -1.8], size: [0.05, 1.9, 0.06] },
    ];
    for (const seg of cableSegments) {
      const cable = new THREE.Mesh(
        new THREE.BoxGeometry(seg.size[0], seg.size[1], seg.size[2]),
        cableMat
      );
      cable.position.set(seg.pos[0], seg.pos[1], seg.pos[2]);
      rootGroup.add(cable);
    }
  }

  private buildItemPickup(theme: ThemeType, obj: InteractiveObject): THREE.Group {
    const group = new THREE.Group();
    const itemId = obj.rewardItem?.id ?? '';

    if (itemId === 'service_chip') {
      const boardMat = new THREE.MeshStandardMaterial({
        color: 0x0d2b3e,
        roughness: 0.28,
        metalness: 0.65,
        emissive: 0x005f73,
        emissiveIntensity: 0.55,
      });
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        roughness: 0.22,
        metalness: 0.92,
      });
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.4,
        roughness: 0.18,
      });

      const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.16), boardMat);
      group.add(pcb);

      const core = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.09), glowMat);
      core.position.y = 0.012;
      group.add(core);

      for (let p = -2; p <= 2; p += 1) {
        const pinFront = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.03), pinMat);
        pinFront.position.set(p * 0.036, 0, 0.09);
        group.add(pinFront);

        const pinBack = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.03), pinMat);
        pinBack.position.set(p * 0.036, 0, -0.09);
        group.add(pinBack);
      }
      return group;
    }

    if (itemId === 'brass_drawer_key') {
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xf4c468,
        roughness: 0.24,
        metalness: 0.9,
        emissive: 0x5c3d0c,
        emissiveIntensity: 0.45,
      });

      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 12, 20), brassMat);
      bow.position.x = -0.08;
      group.add(bow);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.17, 10),
        brassMat
      );
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.035;
      group.add(shaft);

      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.042, 0.014), brassMat);
      bit.position.set(0.095, -0.022, 0);
      group.add(bit);
      return group;
    }

    if (theme === 'horror' || obj.rewardItem?.iconType === 'key') {
      const bronzeMat = new THREE.MeshStandardMaterial({
        color: 0xd4a24c,
        roughness: 0.28,
        metalness: 0.88,
        emissive: 0x3b2608,
        emissiveIntensity: 0.35,
      });

      // Aro ornamentado
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 12, 24), bronzeMat);
      bow.position.x = -0.11;
      group.add(bow);

      const innerCross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.018), bronzeMat);
      innerCross.position.x = -0.11;
      group.add(innerCross);

      // Vástago
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.24, 12),
        bronzeMat
      );
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.06;
      group.add(shaft);

      // Dientes de la llave
      const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.016), bronzeMat);
      tooth1.position.set(0.12, -0.032, 0);
      group.add(tooth1);

      const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.016), bronzeMat);
      tooth2.position.set(0.16, -0.024, 0);
      group.add(tooth2);
    } else {
      const cardBodyMat = new THREE.MeshStandardMaterial({
        color: 0x162b40,
        roughness: 0.24,
        metalness: 0.78,
        emissive: 0x004f6b,
        emissiveIntensity: 0.45,
      });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.1,
        roughness: 0.2,
      });
      const chipMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        roughness: 0.25,
        metalness: 0.9,
      });

      const card = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.016, 0.18), cardBodyMat);
      group.add(card);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.282, 0.018, 0.032), stripeMat);
      stripe.position.z = -0.045;
      group.add(stripe);

      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.045), chipMat);
      chip.position.set(-0.07, 0, 0.03);
      group.add(chip);
    }

    return group;
  }

  private buildExitDoor(
    room: Room,
    obj: InteractiveObject,
    textures: THREE.Texture[]
  ): { group: THREE.Group; handles: ExitDoorVisualHandles } {
    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const { width: w, height: h, depth: d } = obj.size;
    const isOpen = room.exitDoor.getIsOpen();

    const surfaceTex = this.textureFactory.createSurfaceDetailTexture(
      theme,
      palette.furniturePrimary
    );
    textures.push(surfaceTex);

    const frameMat = new THREE.MeshStandardMaterial({
      color: palette.wallSecondary,
      roughness: theme === 'horror' ? 0.65 : 0.34,
      metalness: theme === 'horror' ? 0.35 : 0.76,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: surfaceTex,
      roughness: theme === 'horror' ? 0.7 : 0.36,
      metalness: theme === 'horror' ? 0.16 : 0.72,
    });
    const hardwareMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.3,
      metalness: 0.85,
    });
    const statusLightMaterial = new THREE.MeshStandardMaterial({
      color: isOpen ? 0x22ee77 : 0xee3333,
      emissive: isOpen ? 0x22ff88 : 0xff2222,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    const group = new THREE.Group();
    const jambW = 0.14;

    // Marco perimetral
    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, h, d + 0.06), frameMat);
    leftJamb.position.set(-w / 2 + jambW / 2, h / 2, 0);
    group.add(leftJamb);

    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, h, d + 0.06), frameMat);
    rightJamb.position.set(w / 2 - jambW / 2, h / 2, 0);
    group.add(rightJamb);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.22, d + 0.1), frameMat);
    lintel.position.set(0, h - 0.11, 0);
    group.add(lintel);

    // Baliza luminosa sobre el dintel (rojo bloqueado -> verde desbloqueado)
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.09, 16),
      statusLightMaterial
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.set(0, h - 0.11, d / 2 + 0.06);
    group.add(beacon);

    const statusPointLight = new THREE.PointLight(
      isOpen ? 0x22ff88 : 0xff3333,
      1.0,
      3.5,
      2
    );
    statusPointLight.position.set(0, h - 0.11, d / 2 + 0.3);
    group.add(statusPointLight);

    // Lector de tarjeta o cerradura lateral
    const readerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.26, 0.08),
      hardwareMat
    );
    readerBox.position.set(w / 2 + 0.14, 1.35, d / 2 + 0.02);
    group.add(readerBox);

    // Hojas dobles articuladas o deslizantes
    const innerWidth = w - jambW * 2;
    const leafW = innerWidth / 2 - 0.01;
    const leafH = h - 0.24;
    const openMode: 'swing' | 'slide' = theme === 'horror' ? 'swing' : 'slide';

    const leftWingPivot = new THREE.Group();
    const rightWingPivot = new THREE.Group();

    const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.09), leafMat);
    const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.09), leafMat);

    // Herrajes / manijas sobre cada hoja
    const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.06), hardwareMat);
    const rightHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.06), hardwareMat);

    if (openMode === 'swing') {
      leftWingPivot.position.set(-innerWidth / 2, leafH / 2, 0);
      leftLeaf.position.set(leafW / 2, 0, 0);
      leftHandle.position.set(leafW - 0.12, -0.1, 0.06);
      leftWingPivot.add(leftLeaf, leftHandle);

      rightWingPivot.position.set(innerWidth / 2, leafH / 2, 0);
      rightLeaf.position.set(-leafW / 2, 0, 0);
      rightHandle.position.set(-leafW + 0.12, -0.1, 0.06);
      rightWingPivot.add(rightLeaf, rightHandle);

      if (isOpen) {
        leftWingPivot.rotation.y = -THREE.MathUtils.degToRad(85);
        rightWingPivot.rotation.y = THREE.MathUtils.degToRad(85);
      }
    } else {
      leftWingPivot.position.set(-leafW / 2 - 0.005, leafH / 2, 0);
      leftHandle.position.set(leafW * 0.35, 0, 0.06);
      leftWingPivot.add(leftLeaf, leftHandle);

      rightWingPivot.position.set(leafW / 2 + 0.005, leafH / 2, 0);
      rightHandle.position.set(-leafW * 0.35, 0, 0.06);
      rightWingPivot.add(rightLeaf, rightHandle);

      if (isOpen) {
        leftWingPivot.position.x -= 0.78;
        rightWingPivot.position.x += 0.78;
      }
    }

    group.add(leftWingPivot, rightWingPivot);

    return {
      group,
      handles: {
        leftWingPivot,
        rightWingPivot,
        statusLightMaterial,
        statusPointLight,
        openMode,
      },
    };
  }

  private registerInteractiveGroup(
    group: THREE.Group,
    obj: InteractiveObject,
    interactiveGroups: Map<string, THREE.Group>,
    rootGroup: THREE.Group
  ): void {
    group.name = obj.id;
    group.position.set(obj.position.x, obj.position.y, obj.position.z);
    group.rotation.y = obj.rotationY;

    group.traverse((child) => {
      child.userData.interactiveObjectId = obj.id;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    interactiveGroups.set(obj.id, group);
    rootGroup.add(group);
  }

  private createColliderFromObject(obj: InteractiveObject): ColliderBox2D {
    const cos = Math.abs(Math.cos(obj.rotationY));
    const sin = Math.abs(Math.sin(obj.rotationY));
    const halfX = (obj.size.width * cos + obj.size.depth * sin) / 2;
    const halfZ = (obj.size.width * sin + obj.size.depth * cos) / 2;

    return {
      id: obj.id,
      minX: obj.position.x - halfX,
      maxX: obj.position.x + halfX,
      minZ: obj.position.z - halfZ,
      maxZ: obj.position.z + halfZ,
      active: true,
    };
  }

  private extractSecretPin(room: Room): string {
    const pinPuzzle = room.getPuzzle('pin_puzzle');
    const strategy = pinPuzzle?.getStrategy();
    if (strategy instanceof PinCodeStrategy) {
      return strategy.getExpectedPin();
    }
    return '0000';
  }
}
