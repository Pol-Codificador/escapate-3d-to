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
 * Conjunto completo de mallas, grupos interactivos, luces y colisionadores generados para una sala.
 */
export interface BuiltRoomSceneAssets {
  readonly rootGroup: THREE.Group;
  readonly interactiveGroups: Map<string, THREE.Group>;
  readonly switchHandles: Map<SwitchLeverSymbol, SwitchVisualHandles>;
  readonly clueWallHandles: ClueWallVisualHandles | null;
  readonly safeHandles: SafeVisualHandles | null;
  readonly itemPickupGroup: THREE.Group | null;
  readonly itemPickupBaseY: number;
  readonly exitDoorHandles: ExitDoorVisualHandles | null;
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
    const colliders: ColliderBox2D[] = [];
    const disposableTextures: THREE.Texture[] = [];

    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;
    const secretPin = this.extractSecretPin(room);

    // 1. Estructura arquitectónica de la habitación (10 × 4 × 10 m)
    this.buildArchitecture(rootGroup, room, disposableTextures);

    // 2. Pedestal fijo bajo la zona del ítem recompensa (x = 3.6, z = 0.5)
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

    // 3. Construcción compuesta de los 6 objetos interactivos
    let clueWallHandles: ClueWallVisualHandles | null = null;
    let safeHandles: SafeVisualHandles | null = null;
    let itemPickupGroup: THREE.Group | null = null;
    let itemPickupBaseY = 0.95;
    let exitDoorHandles: ExitDoorVisualHandles | null = null;

    for (const obj of room.getAllObjects()) {
      switch (obj.kind) {
        case 'note': {
          const deskGroup = this.buildDeskWithNote(room, obj, disposableTextures);
          this.registerInteractiveGroup(deskGroup, obj, interactiveGroups, rootGroup);
          colliders.push(this.createColliderFromObject(obj));
          break;
        }
        case 'switch_panel': {
          const { group, levers } = this.buildSwitchPanel(room, obj, disposableTextures);
          for (const lever of levers) {
            switchHandles.set(lever.symbol, lever);
          }
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
          itemPickupGroup = this.buildItemPickup(theme, obj);
          itemPickupBaseY = obj.position.y;
          itemPickupGroup.visible = obj.isVisible;
          this.registerInteractiveGroup(itemPickupGroup, obj, interactiveGroups, rootGroup);
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
      clueWallHandles,
      safeHandles,
      itemPickupGroup,
      itemPickupBaseY,
      exitDoorHandles,
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

    // Lámpara central colgante del techo
    const fixtureGroup = new THREE.Group();
    fixtureGroup.position.set(0, height, 0);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), trimMat);
    rod.position.y = -0.22;
    fixtureGroup.add(rod);

    const shade = new THREE.Mesh(
      theme === 'horror'
        ? new THREE.ConeGeometry(0.42, 0.25, 16, 1, true)
        : new THREE.CylinderGeometry(0.46, 0.38, 0.16, 20),
      trimMat
    );
    shade.position.y = -0.46;
    fixtureGroup.add(shade);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: room.themeConfiguration.lightingConfig.mainLightColor,
      emissive: room.themeConfiguration.lightingConfig.mainLightColor,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), bulbMat);
    bulb.position.y = -0.5;
    fixtureGroup.add(bulb);
    rootGroup.add(fixtureGroup);
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
  ): { group: THREE.Group; levers: SwitchVisualHandles[] } {
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
      switchModule.position.set(xOffset, 0, d / 2 + 0.015);
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
      led.position.set(0, 0.24, 0.02);
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

    return { group, levers };
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

  private buildItemPickup(theme: ThemeType, obj: InteractiveObject): THREE.Group {
    const group = new THREE.Group();

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
