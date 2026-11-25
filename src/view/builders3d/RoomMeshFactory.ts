/**
 * @pattern MVC (Arquitectónico) — Consumidor de Builder & Abstract Factory
 * @role 3D Composite Mesh Builder (Vista 3D)
 *
 * Problema de diseño que resuelve:
 * Traduce la entidad pura `Room` del Modelo en una habitación 3D compuesta de
 * `10 × 4 × 10` m con materiales PBR (`MeshStandardMaterial`), sombras,
 * texturas procedurales y los 6 muebles interactivos detallados (sin cubos
 * planos), propagando `userData.interactiveObjectId` y generando colisionadores
 * AABB exactos para la cámara en primera persona.
 */

import * as THREE from 'three';
import type { ThemeColorPalette, ThemeType } from '../../core/interfaces/IThemeFactory';
import type { InteractiveObject } from '../../model/entities/InteractiveObject';
import type { Room } from '../../model/entities/Room';
import { PinCodeStrategy } from '../../model/puzzles/strategies/PinCodeStrategy';
import { SequenceStrategy } from '../../model/puzzles/strategies/SequenceStrategy';
import { ProceduralTextureFactory } from './ProceduralTextureFactory';

/**
 * Caja envolvente AABB en el plano XZ para colisiones contra muebles sólidos.
 */
export interface ColliderBox {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Referencias animables de una palanca y LED del panel de interruptores.
 */
export interface SwitchLeverRig {
  readonly symbol: string;
  readonly pivot: THREE.Group;
  readonly ledMaterial: THREE.MeshStandardMaterial;
}

/**
 * Rig interactivo del panel de interruptores (`switch_panel`).
 */
export interface SwitchPanelRig {
  readonly levers: ReadonlyMap<string, SwitchLeverRig>;
}

/**
 * Rig revelable de la pared de pista (`clue_wall`).
 */
export interface ClueWallRig {
  readonly displayMaterial: THREE.MeshStandardMaterial;
  readonly hiddenTexture: THREE.CanvasTexture;
  readonly revealedTexture: THREE.CanvasTexture;
  readonly revealLight: THREE.SpotLight;
  readonly fixtureBulbMaterial: THREE.MeshStandardMaterial;
}

/**
 * Rig articulado de la caja fuerte / terminal criogénica (`safe`).
 */
export interface SafeRig {
  readonly doorPivot: THREE.Group;
  readonly statusLedMaterial: THREE.MeshStandardMaterial;
}

/**
 * Rig flotante del ítem de recompensa (`reward_item_pickup`).
 */
export interface ItemPickupRig {
  readonly rootGroup: THREE.Group;
  readonly floatingMesh: THREE.Group;
  readonly baseLocalY: number;
}

/**
 * Rig animado de la puerta de salida (`exit_door`).
 */
export interface ExitDoorRig {
  readonly leftLeaf: THREE.Group;
  readonly rightLeaf: THREE.Group;
  readonly mode: 'pivot' | 'slide';
  readonly indicatorMaterial: THREE.MeshStandardMaterial;
  readonly indicatorLight: THREE.PointLight;
}

/**
 * Resultado completo de construir la sala 3D y sus referencias de animación.
 */
export interface BuiltRoom3D {
  readonly rootGroup: THREE.Group;
  readonly interactiveGroups: ReadonlyMap<string, THREE.Group>;
  readonly colliders: readonly ColliderBox[];
  readonly switchPanelRig: SwitchPanelRig | null;
  readonly clueWallRig: ClueWallRig | null;
  readonly safeRig: SafeRig | null;
  readonly itemPickupRig: ItemPickupRig | null;
  readonly exitDoorRig: ExitDoorRig | null;
  dispose(): void;
}

/**
 * Constructor de mallas compuestas y arquitectura 3D a partir de una `Room` del Modelo.
 */
export class RoomMeshFactory {
  /**
   * Construye toda la escena 3D de la sala a partir del estado puro de `Room`.
   */
  public build(room: Room): BuiltRoom3D {
    const textureFactory = new ProceduralTextureFactory();
    const rootGroup = new THREE.Group();
    rootGroup.name = 'RoomRoot';

    const theme = room.themeConfiguration.themeType;
    const palette = room.themeConfiguration.colorPalette;

    const sequenceExpected = this.extractExpectedSequence(room);
    const secretPin = this.extractExpectedPin(room);

    this.buildArchitecture(rootGroup, room, theme, palette, textureFactory);

    const interactiveGroups = new Map<string, THREE.Group>();
    const colliders: ColliderBox[] = [];

    let switchPanelRig: SwitchPanelRig | null = null;
    let clueWallRig: ClueWallRig | null = null;
    let safeRig: SafeRig | null = null;
    let itemPickupRig: ItemPickupRig | null = null;
    let exitDoorRig: ExitDoorRig | null = null;

    for (const obj of room.getAllObjects()) {
      let builtGroup: THREE.Group;

      switch (obj.kind) {
        case 'note':
          builtGroup = this.buildDeskWithNote(
            obj,
            theme,
            palette,
            sequenceExpected,
            textureFactory
          );
          colliders.push(this.computeCollider(obj));
          break;
        case 'switch_panel': {
          const built = this.buildSwitchPanel(
            obj,
            theme,
            palette,
            textureFactory
          );
          builtGroup = built.group;
          switchPanelRig = built.rig;
          break;
        }
        case 'clue_wall': {
          const built = this.buildClueWall(
            obj,
            theme,
            palette,
            secretPin,
            textureFactory
          );
          builtGroup = built.group;
          clueWallRig = built.rig;
          break;
        }
        case 'safe': {
          const built = this.buildSafe(obj, theme, palette, textureFactory);
          builtGroup = built.group;
          safeRig = built.rig;
          colliders.push(this.computeCollider(obj));
          break;
        }
        case 'item_pickup': {
          const pedestal = this.buildRewardPedestal(obj, theme, palette);
          rootGroup.add(pedestal);
          colliders.push({
            id: `${obj.id}_pedestal`,
            minX: obj.position.x - 0.34,
            maxX: obj.position.x + 0.34,
            minZ: obj.position.z - 0.34,
            maxZ: obj.position.z + 0.34,
          });

          const built = this.buildItemPickup(theme, palette);
          builtGroup = built.group;
          itemPickupRig = built.rig;
          break;
        }
        case 'exit_door': {
          const built = this.buildExitDoor(obj, theme, palette);
          builtGroup = built.group;
          exitDoorRig = built.rig;
          break;
        }
      }

      builtGroup.position.set(obj.position.x, obj.position.y, obj.position.z);
      builtGroup.rotation.y = obj.rotationY;
      builtGroup.visible = obj.isVisible;
      this.tagInteractiveHierarchy(builtGroup, obj.id);

      rootGroup.add(builtGroup);
      interactiveGroups.set(obj.id, builtGroup);
    }

    return {
      rootGroup,
      interactiveGroups,
      colliders,
      switchPanelRig,
      clueWallRig,
      safeRig,
      itemPickupRig,
      exitDoorRig,
      dispose: (): void => {
        this.disposeObjectTree(rootGroup);
        textureFactory.disposeAll();
      },
    };
  }

  private buildArchitecture(
    rootGroup: THREE.Group,
    room: Room,
    theme: ThemeType,
    palette: ThemeColorPalette,
    textureFactory: ProceduralTextureFactory
  ): void {
    const { width, height, depth } = room.dimensions;
    const halfW = width / 2;
    const halfD = depth / 2;

    const floorTexture = textureFactory.createFloorTexture(theme, palette);
    const wallTexture = textureFactory.createWallTexture(theme, palette);
    const ceilingTexture = textureFactory.createCeilingTexture(theme, palette);

    // Suelo
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: theme === 'horror' ? 0.84 : 0.42,
      metalness: theme === 'horror' ? 0.08 : 0.55,
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    rootGroup.add(floorMesh);

    // Techo
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.85,
      metalness: theme === 'horror' ? 0.05 : 0.45,
    });
    const ceilingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      ceilingMat
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.y = height;
    ceilingMesh.receiveShadow = true;
    rootGroup.add(ceilingMesh);

    // 4 Paredes
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: theme === 'horror' ? 0.88 : 0.48,
      metalness: theme === 'horror' ? 0.05 : 0.45,
    });

    const northWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    northWall.position.set(0, height / 2, -halfD);
    northWall.receiveShadow = true;
    rootGroup.add(northWall);

    const southWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    southWall.rotation.y = Math.PI;
    southWall.position.set(0, height / 2, halfD);
    southWall.receiveShadow = true;
    rootGroup.add(southWall);

    const westWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-halfW, height / 2, 0);
    westWall.receiveShadow = true;
    rootGroup.add(westWall);

    const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.position.set(halfW, height / 2, 0);
    eastWall.receiveShadow = true;
    rootGroup.add(eastWall);

    // Zócalos y vigas decorativas
    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.wallSecondary,
      roughness: theme === 'horror' ? 0.72 : 0.35,
      metalness: theme === 'horror' ? 0.15 : 0.65,
    });

    const baseboardConfigs: ReadonlyArray<[number, number, number, number, number]> = [
      [width, 0.18, 0.08, 0, -halfD + 0.04],
      [width, 0.18, 0.08, 0, halfD - 0.04],
      [0.08, 0.18, depth, -halfW + 0.04, 0],
      [0.08, 0.18, depth, halfW - 0.04, 0],
    ];

    for (const [bw, bh, bd, bx, bz] of baseboardConfigs) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), trimMat);
      board.position.set(bx, bh / 2, bz);
      board.receiveShadow = true;
      rootGroup.add(board);

      const crown = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.16, bd), trimMat);
      crown.position.set(bx, height - 0.08, bz);
      rootGroup.add(crown);
    }

    // Pilares en las 4 esquinas
    const cornerOffsets: ReadonlyArray<[number, number]> = [
      [-halfW + 0.15, -halfD + 0.15],
      [halfW - 0.15, -halfD + 0.15],
      [-halfW + 0.15, halfD - 0.15],
      [halfW - 0.15, halfD - 0.15],
    ];

    for (const [cx, cz] of cornerOffsets) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, height, 0.3),
        trimMat
      );
      pillar.position.set(cx, height / 2, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      rootGroup.add(pillar);
    }

    // Vigas transversales de techo
    for (const zPos of [-2.4, 0, 2.4]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.2, 0.18, 0.24),
        trimMat
      );
      beam.position.set(0, height - 0.09, zPos);
      beam.castShadow = true;
      rootGroup.add(beam);
    }

    // Luminaria central colgante en el techo
    const fixtureGroup = new THREE.Group();
    fixtureGroup.position.set(0, height - 0.25, 0);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12),
      trimMat
    );
    stem.position.y = 0.05;
    fixtureGroup.add(stem);

    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.36, 0.2, 16),
      trimMat
    );
    shade.position.y = -0.14;
    fixtureGroup.add(shade);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: room.themeConfiguration.lightingConfig.mainLightColor,
      emissive: room.themeConfiguration.lightingConfig.mainLightColor,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), bulbMat);
    bulb.position.y = -0.22;
    fixtureGroup.add(bulb);
    rootGroup.add(fixtureGroup);
  }

  private buildDeskWithNote(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette,
    sequenceExpected: readonly string[],
    textureFactory: ProceduralTextureFactory
  ): THREE.Group {
    const group = new THREE.Group();
    const { width, height, depth } = obj.size;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: palette.furniturePrimary,
      roughness: theme === 'horror' ? 0.72 : 0.34,
      metalness: theme === 'horror' ? 0.12 : 0.62,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.35,
      metalness: 0.75,
    });

    // Tablero principal
    const topThickness = 0.08;
    const topY = height - topThickness / 2;
    const tabletop = new THREE.Mesh(
      new THREE.BoxGeometry(width, topThickness, depth),
      bodyMat
    );
    tabletop.position.y = topY;
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    group.add(tabletop);

    // Moldura bajo tablero
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.14, 0.14, depth - 0.14),
      bodyMat
    );
    apron.position.y = height - 0.14;
    apron.castShadow = true;
    apron.receiveShadow = true;
    group.add(apron);

    // 4 patas
    const legHeight = height - topThickness;
    const legGeo = new THREE.BoxGeometry(0.09, legHeight, 0.09);
    const legX = width / 2 - 0.1;
    const legZ = depth / 2 - 0.1;
    const legCoords: ReadonlyArray<[number, number]> = [
      [-legX, -legZ],
      [legX, -legZ],
      [-legX, legZ],
      [legX, legZ],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(lx, legHeight / 2, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }

    // Cajón frontal con tirador
    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.45, 0.13, 0.04),
      bodyMat
    );
    drawer.position.set(0, height - 0.15, depth / 2 - 0.05);
    drawer.castShadow = true;
    group.add(drawer);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10),
      accentMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, height - 0.15, depth / 2 - 0.015);
    group.add(handle);

    // Lámpara de escritorio
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.04, 16),
      accentMat
    );
    lampBase.position.set(-width * 0.3, height + 0.02, -depth * 0.2);
    lampBase.castShadow = true;
    group.add(lampBase);

    const lampNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.26, 10),
      accentMat
    );
    lampNeck.position.set(-width * 0.3, height + 0.16, -depth * 0.2);
    lampNeck.castShadow = true;
    group.add(lampNeck);

    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.14, 16, 1, true),
      accentMat
    );
    lampShade.position.set(-width * 0.27, height + 0.28, -depth * 0.17);
    lampShade.rotation.z = -0.35;
    lampShade.castShadow = true;
    group.add(lampShade);

    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0xffd194 : 0x7fffe8,
      emissive: theme === 'horror' ? 0xff9f43 : 0x00d2ff,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const lampBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      lampGlowMat
    );
    lampBulb.position.set(-width * 0.26, height + 0.25, -depth * 0.16);
    group.add(lampBulb);

    // Nota o Datapad con textura legible
    const noteTexture = textureFactory.createNoteTexture(theme, sequenceExpected);
    const noteMat = new THREE.MeshStandardMaterial({
      map: noteTexture,
      roughness: theme === 'horror' ? 0.85 : 0.25,
      emissive: theme === 'scifi' ? new THREE.Color(0x004455) : new THREE.Color(0x000000),
      emissiveIntensity: theme === 'scifi' ? 0.65 : 0,
    });

    if (theme === 'scifi') {
      const tabletFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.025, 0.36),
        accentMat
      );
      tabletFrame.position.set(0.14, height + 0.013, 0.06);
      tabletFrame.rotation.y = -0.18;
      tabletFrame.castShadow = true;
      group.add(tabletFrame);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.31), noteMat);
      screen.rotation.x = -Math.PI / 2;
      screen.rotation.z = 0.18;
      screen.position.set(0.14, height + 0.027, 0.06);
      group.add(screen);
    } else {
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.008, 0.42),
        noteMat
      );
      paper.position.set(0.12, height + 0.006, 0.06);
      paper.rotation.y = 0.14;
      paper.castShadow = true;
      paper.receiveShadow = true;
      group.add(paper);
    }

    return group;
  }

  private buildSwitchPanel(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette,
    textureFactory: ProceduralTextureFactory
  ): { group: THREE.Group; rig: SwitchPanelRig } {
    const group = new THREE.Group();
    const { width, height, depth } = obj.size;

    const casingMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x3b3531 : 0x1b2b3a,
      roughness: theme === 'horror' ? 0.68 : 0.32,
      metalness: theme === 'horror' ? 0.65 : 0.8,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Caja principal
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth * 0.7),
      casingMat
    );
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    // Marco frontal
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.04),
      trimMat
    );
    frame.position.z = -depth * 0.25;
    frame.castShadow = true;
    group.add(frame);

    // Tuberías verticales decorativas
    for (const px of [-width * 0.28, width * 0.28]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.4, 10),
        trimMat
      );
      pipe.position.set(px, height / 2 + 0.65, -0.02);
      pipe.castShadow = true;
      group.add(pipe);
    }

    const levers = new Map<string, SwitchLeverRig>();
    const symbols = ['A', 'B', 'C'];
    const spacing = width / 3.4;

    symbols.forEach((symbol, index) => {
      const offsetX = (index - 1) * spacing;

      // Placa con letra A/B/C
      const labelMat = new THREE.MeshStandardMaterial({
        map: textureFactory.createSwitchLabelTexture(symbol, theme),
        roughness: 0.45,
      });
      const labelPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.14),
        labelMat
      );
      labelPlate.position.set(offsetX, 0.24, depth * 0.36);
      group.add(labelPlate);

      // LED indicador
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xff3b30,
        emissive: 0xff2a1f,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), ledMat);
      led.position.set(offsetX, 0.08, depth * 0.36);
      group.add(led);

      // Pivote y palanca
      const leverPivot = new THREE.Group();
      leverPivot.position.set(offsetX, -0.14, depth * 0.35);
      leverPivot.rotation.x = 0.45; // Posición inicial abajo

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.16, 10),
        trimMat
      );
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.08;
      shaft.castShadow = true;
      leverPivot.add(shaft);

      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 12),
        trimMat
      );
      knob.position.z = 0.16;
      knob.castShadow = true;
      leverPivot.add(knob);

      group.add(leverPivot);
      levers.set(symbol, {
        symbol,
        pivot: leverPivot,
        ledMaterial: ledMat,
      });
    });

    return { group, rig: { levers } };
  }

  private buildClueWall(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette,
    secretPin: string,
    textureFactory: ProceduralTextureFactory
  ): { group: THREE.Group; rig: ClueWallRig } {
    const group = new THREE.Group();
    const { width, height, depth } = obj.size;

    const frameMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? palette.furnitureSecondary : 0x1c3144,
      roughness: theme === 'horror' ? 0.52 : 0.28,
      metalness: theme === 'horror' ? 0.48 : 0.82,
    });

    // Marco exterior compuesto por 4 listones
    const borderThickness = 0.09;
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(width, borderThickness, depth),
      frameMat
    );
    topBar.position.y = height / 2 - borderThickness / 2;
    topBar.castShadow = true;
    group.add(topBar);

    const bottomBar = new THREE.Mesh(
      new THREE.BoxGeometry(width, borderThickness, depth),
      frameMat
    );
    bottomBar.position.y = -height / 2 + borderThickness / 2;
    bottomBar.castShadow = true;
    group.add(bottomBar);

    const leftBar = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, height - borderThickness * 2, depth),
      frameMat
    );
    leftBar.position.x = -width / 2 + borderThickness / 2;
    leftBar.castShadow = true;
    group.add(leftBar);

    const rightBar = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, height - borderThickness * 2, depth),
      frameMat
    );
    rightBar.position.x = width / 2 - borderThickness / 2;
    rightBar.castShadow = true;
    group.add(rightBar);

    // Superficie del lienzo / pantalla holográfica
    const hiddenTexture = textureFactory.createClueWallTexture(
      theme,
      secretPin,
      false
    );
    const revealedTexture = textureFactory.createClueWallTexture(
      theme,
      secretPin,
      true
    );

    const displayMat = new THREE.MeshStandardMaterial({
      map: hiddenTexture,
      roughness: theme === 'horror' ? 0.78 : 0.2,
      metalness: theme === 'horror' ? 0.05 : 0.3,
      emissive: new THREE.Color(theme === 'horror' ? 0x7b2cbf : 0x00f5d4),
      emissiveIntensity: 0,
    });

    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width - borderThickness * 2, height - borderThickness * 2),
      displayMat
    );
    canvasMesh.position.z = depth * 0.15;
    canvasMesh.receiveShadow = true;
    group.add(canvasMesh);

    // Lámpara UV / emisor holográfico montado encima del marco
    const fixtureHood = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.08, 0.18),
      frameMat
    );
    fixtureHood.position.set(0, height / 2 + 0.14, 0.16);
    fixtureHood.castShadow = true;
    group.add(fixtureHood);

    const fixtureBulbMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x9d4edd : 0x00f5d4,
      emissive: theme === 'horror' ? 0x9d4edd : 0x00f5d4,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    const fixtureTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.46, 12),
      fixtureBulbMat
    );
    fixtureTube.rotation.z = Math.PI / 2;
    fixtureTube.position.set(0, height / 2 + 0.1, 0.17);
    group.add(fixtureTube);

    // Foco dedicado apagado al inicio
    const revealLight = new THREE.SpotLight(
      theme === 'horror' ? 0xb565ff : 0x00f5d4,
      0,
      5.5,
      Math.PI / 3.2,
      0.55,
      1.2
    );
    revealLight.position.set(0, height / 2 + 0.15, 0.45);
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, 0, 0.05);
    group.add(lightTarget);
    revealLight.target = lightTarget;
    group.add(revealLight);

    return {
      group,
      rig: {
        displayMaterial: displayMat,
        hiddenTexture,
        revealedTexture,
        revealLight,
        fixtureBulbMaterial: fixtureBulbMat,
      },
    };
  }

  private buildSafe(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette,
    textureFactory: ProceduralTextureFactory
  ): { group: THREE.Group; rig: SafeRig } {
    const group = new THREE.Group();
    const { width, height, depth } = obj.size;
    const wallT = 0.08;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x2a2d32 : 0x1d2e40,
      roughness: theme === 'horror' ? 0.56 : 0.28,
      metalness: 0.82,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.32,
      metalness: 0.86,
    });

    // Cuerpo hueco (base, techo, izquierda, derecha, fondo y repisa interior)
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(width, wallT, depth),
      bodyMat
    );
    bottom.position.y = wallT / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    group.add(bottom);

    const top = new THREE.Mesh(new THREE.BoxGeometry(width, wallT, depth), bodyMat);
    top.position.y = height - wallT / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const innerH = height - wallT * 2;
    const left = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, innerH, depth),
      bodyMat
    );
    left.position.set(-width / 2 + wallT / 2, height / 2, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    group.add(left);

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, innerH, depth),
      bodyMat
    );
    right.position.set(width / 2 - wallT / 2, height / 2, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    group.add(right);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(width - wallT * 2, innerH, wallT),
      bodyMat
    );
    back.position.set(0, height / 2, -depth / 2 + wallT / 2);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(width - wallT * 2, 0.04, depth - wallT * 2),
      trimMat
    );
    shelf.position.set(0, height * 0.48, -0.02);
    shelf.receiveShadow = true;
    group.add(shelf);

    // Tubos laterales o remaches temáticos
    if (theme === 'scifi') {
      for (const sx of [-width / 2 - 0.03, width / 2 + 0.03]) {
        const cryoPipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, height * 0.78, 12),
          new THREE.MeshStandardMaterial({
            color: 0x00d2ff,
            emissive: 0x006688,
            emissiveIntensity: 0.7,
            roughness: 0.2,
          })
        );
        cryoPipe.position.set(sx, height * 0.5, depth * 0.15);
        group.add(cryoPipe);
      }
    }

    // Subgrupo pivote en bisagra izquierda para abrir hacia afuera
    const doorPivot = new THREE.Group();
    const doorWidth = width - wallT * 2;
    const doorHeight = innerH - 0.02;
    doorPivot.position.set(-doorWidth / 2, height / 2, depth / 2 - 0.03);

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, doorHeight, 0.06),
      bodyMat
    );
    doorPanel.position.set(doorWidth / 2, 0, 0);
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;
    doorPivot.add(doorPanel);

    // Volante / manija
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.02, 10, 20),
      trimMat
    );
    wheel.position.set(doorWidth * 0.34, -0.06, 0.055);
    wheel.castShadow = true;
    doorPivot.add(wheel);

    // Teclado numérico frontal
    const keypadMat = new THREE.MeshStandardMaterial({
      map: textureFactory.createKeypadTexture(theme),
      roughness: 0.35,
      emissive: theme === 'scifi' ? new THREE.Color(0x003344) : new THREE.Color(0x000000),
      emissiveIntensity: theme === 'scifi' ? 0.55 : 0,
    });
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.03), keypadMat);
    keypad.position.set(doorWidth * 0.72, 0.06, 0.04);
    doorPivot.add(keypad);

    // LED de estado
    const statusLedMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff2a1f,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    const statusLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 12),
      statusLedMat
    );
    statusLed.position.set(doorWidth * 0.72, 0.28, 0.05);
    doorPivot.add(statusLed);

    group.add(doorPivot);

    return {
      group,
      rig: {
        doorPivot,
        statusLedMaterial: statusLedMat,
      },
    };
  }

  private buildRewardPedestal(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette
  ): THREE.Group {
    const pedestal = new THREE.Group();
    pedestal.position.set(obj.position.x, 0, obj.position.z);

    const baseMat = new THREE.MeshStandardMaterial({
      color: palette.furniturePrimary,
      roughness: theme === 'horror' ? 0.7 : 0.32,
      metalness: theme === 'horror' ? 0.2 : 0.75,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x6b1822 : palette.furnitureSecondary,
      roughness: theme === 'horror' ? 0.9 : 0.25,
      metalness: theme === 'horror' ? 0.05 : 0.8,
      emissive: theme === 'scifi' ? new THREE.Color(0x003c4d) : new THREE.Color(0x000000),
      emissiveIntensity: theme === 'scifi' ? 0.5 : 0,
    });

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.12, 0.56),
      baseMat
    );
    plinth.position.y = 0.06;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    pedestal.add(plinth);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.72, 16),
      baseMat
    );
    column.position.y = 0.48;
    column.castShadow = true;
    column.receiveShadow = true;
    pedestal.add(column);

    const topPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.08, 0.48),
      baseMat
    );
    topPlate.position.y = 0.88;
    topPlate.castShadow = true;
    topPlate.receiveShadow = true;
    pedestal.add(topPlate);

    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.04, 0.36),
      accentMat
    );
    cushion.position.y = 0.94;
    cushion.receiveShadow = true;
    pedestal.add(cushion);

    return pedestal;
  }

  private buildItemPickup(
    theme: ThemeType,
    palette: ThemeColorPalette
  ): { group: THREE.Group; rig: ItemPickupRig } {
    const group = new THREE.Group();
    const floatingMesh = new THREE.Group();
    const baseLocalY = 0.14;
    floatingMesh.position.y = baseLocalY;

    if (theme === 'horror') {
      const bronzeMat = new THREE.MeshStandardMaterial({
        color: 0xd4a24c,
        roughness: 0.28,
        metalness: 0.88,
        emissive: new THREE.Color(0x4a3008),
        emissiveIntensity: 0.35,
      });

      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.065, 0.016, 10, 20),
        bronzeMat
      );
      bow.position.x = -0.11;
      bow.castShadow = true;
      floatingMesh.add(bow);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.24, 10),
        bronzeMat
      );
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.05;
      shaft.castShadow = true;
      floatingMesh.add(shaft);

      const tooth1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.055, 0.016),
        bronzeMat
      );
      tooth1.position.set(0.11, -0.03, 0);
      tooth1.castShadow = true;
      floatingMesh.add(tooth1);

      const tooth2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.04, 0.016),
        bronzeMat
      );
      tooth2.position.set(0.15, -0.022, 0);
      tooth2.castShadow = true;
      floatingMesh.add(tooth2);
    } else {
      const cardMat = new THREE.MeshStandardMaterial({
        color: 0x0e2a3d,
        roughness: 0.22,
        metalness: 0.78,
        emissive: new THREE.Color(0x004466),
        emissiveIntensity: 0.45,
      });

      const glowStripMat = new THREE.MeshStandardMaterial({
        color: palette.interactiveHighlight,
        emissive: palette.interactiveHighlight,
        emissiveIntensity: 1.5,
        roughness: 0.15,
      });

      const cardBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.018, 0.18),
        cardMat
      );
      cardBody.castShadow = true;
      floatingMesh.add(cardBody);

      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.022, 0.045),
        new THREE.MeshStandardMaterial({
          color: 0xffd166,
          metalness: 0.9,
          roughness: 0.2,
        })
      );
      chip.position.set(-0.07, 0.004, 0);
      floatingMesh.add(chip);

      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.021, 0.026),
        glowStripMat
      );
      strip.position.set(0, 0.004, -0.055);
      floatingMesh.add(strip);
    }

    // Luz sutil de realce cuando el objeto está visible
    const glowLight = new THREE.PointLight(
      theme === 'horror' ? 0xffb347 : 0x00f5d4,
      0.85,
      2.2
    );
    glowLight.position.set(0, 0.25, 0);
    group.add(glowLight);

    group.add(floatingMesh);

    return {
      group,
      rig: {
        rootGroup: group,
        floatingMesh,
        baseLocalY,
      },
    };
  }

  private buildExitDoor(
    obj: InteractiveObject,
    theme: ThemeType,
    palette: ThemeColorPalette
  ): { group: THREE.Group; rig: ExitDoorRig } {
    const group = new THREE.Group();
    const { width, height, depth } = obj.size;

    const frameMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x2b1d16 : 0x243b53,
      roughness: theme === 'horror' ? 0.72 : 0.35,
      metalness: theme === 'horror' ? 0.25 : 0.78,
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: theme === 'horror' ? 0x45281c : 0x334e68,
      roughness: theme === 'horror' ? 0.76 : 0.32,
      metalness: theme === 'horror' ? 0.15 : 0.75,
    });

    const hardwareMat = new THREE.MeshStandardMaterial({
      color: palette.furnitureSecondary,
      roughness: 0.32,
      metalness: 0.85,
    });

    // Marco perimetral sólido
    const postWidth = 0.16;
    const leftPost = new THREE.Mesh(
      new THREE.BoxGeometry(postWidth, height, depth + 0.08),
      frameMat
    );
    leftPost.position.set(-width / 2 - postWidth / 2, height / 2, 0);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    group.add(leftPost);

    const rightPost = new THREE.Mesh(
      new THREE.BoxGeometry(postWidth, height, depth + 0.08),
      frameMat
    );
    rightPost.position.set(width / 2 + postWidth / 2, height / 2, 0);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    group.add(rightPost);

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(width + postWidth * 2, 0.22, depth + 0.1),
      frameMat
    );
    lintel.position.set(0, height + 0.11, 0);
    lintel.castShadow = true;
    group.add(lintel);

    // Fondo luminoso detrás de la puerta (se ve cuando abre)
    const exitBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        color: theme === 'horror' ? 0x162436 : 0x9ef0ff,
        emissive: theme === 'horror' ? 0x1b334f : 0x00d2ff,
        emissiveIntensity: theme === 'horror' ? 0.45 : 0.85,
      })
    );
    exitBackdrop.position.set(0, height / 2, -0.09);
    group.add(exitBackdrop);

    // Hojas dobles articuladas / deslizantes
    const leafWidth = width / 2 - 0.01;
    const leftLeaf = new THREE.Group();
    const rightLeaf = new THREE.Group();

    const mode: 'pivot' | 'slide' = theme === 'horror' ? 'pivot' : 'slide';

    if (mode === 'pivot') {
      leftLeaf.position.set(-width / 2, 0, 0);
      rightLeaf.position.set(width / 2, 0, 0);

      const leftMesh = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, height, 0.09),
        leafMat
      );
      leftMesh.position.set(leafWidth / 2, height / 2, 0);
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      leftLeaf.add(leftMesh);

      const rightMesh = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, height, 0.09),
        leafMat
      );
      rightMesh.position.set(-leafWidth / 2, height / 2, 0);
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      rightLeaf.add(rightMesh);

      // Herrajes y picaportes
      for (const yBar of [0.7, 1.4, 2.1]) {
        const strapL = new THREE.Mesh(
          new THREE.BoxGeometry(leafWidth * 0.72, 0.06, 0.11),
          hardwareMat
        );
        strapL.position.set(leafWidth * 0.38, yBar, 0);
        leftLeaf.add(strapL);

        const strapR = new THREE.Mesh(
          new THREE.BoxGeometry(leafWidth * 0.72, 0.06, 0.11),
          hardwareMat
        );
        strapR.position.set(-leafWidth * 0.38, yBar, 0);
        rightLeaf.add(strapR);
      }

      const handleL = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        hardwareMat
      );
      handleL.position.set(leafWidth - 0.1, 1.12, 0.075);
      leftLeaf.add(handleL);

      const handleR = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        hardwareMat
      );
      handleR.position.set(-leafWidth + 0.1, 1.12, 0.075);
      rightLeaf.add(handleR);
    } else {
      leftLeaf.position.set(-leafWidth / 2, 0, 0);
      rightLeaf.position.set(leafWidth / 2, 0, 0);

      const leftMesh = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, height, 0.1),
        leafMat
      );
      leftMesh.position.set(0, height / 2, 0);
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      leftLeaf.add(leftMesh);

      const rightMesh = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, height, 0.1),
        leafMat
      );
      rightMesh.position.set(0, height / 2, 0);
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      rightLeaf.add(rightMesh);

      // Franjas blindadas en hojas deslizantes
      for (const leaf of [leftLeaf, rightLeaf]) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(leafWidth * 0.8, 0.14, 0.13),
          hardwareMat
        );
        rib.position.set(0, height * 0.5, 0);
        leaf.add(rib);
      }
    }

    group.add(leftLeaf);
    group.add(rightLeaf);

    // Lector / cerradura lateral + LED de estado
    const readerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.3, 0.08),
      frameMat
    );
    readerBox.position.set(width / 2 + postWidth + 0.12, 1.32, 0.08);
    readerBox.castShadow = true;
    group.add(readerBox);

    const indicatorMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff2a1f,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    const indicatorMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 14, 14),
      indicatorMaterial
    );
    indicatorMesh.position.set(width / 2 + postWidth + 0.12, 1.4, 0.13);
    group.add(indicatorMesh);

    const topBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.09, 0.08),
      indicatorMaterial
    );
    topBeacon.position.set(0, height + 0.27, 0.06);
    group.add(topBeacon);

    const indicatorLight = new THREE.PointLight(0xff2a1f, 0.7, 3.0);
    indicatorLight.position.set(0, height + 0.1, 0.45);
    group.add(indicatorLight);

    return {
      group,
      rig: {
        leftLeaf,
        rightLeaf,
        mode,
        indicatorMaterial,
        indicatorLight,
      },
    };
  }

  private computeCollider(obj: InteractiveObject): ColliderBox {
    const cos = Math.abs(Math.cos(obj.rotationY));
    const sin = Math.abs(Math.sin(obj.rotationY));
    const halfX = (cos * obj.size.width + sin * obj.size.depth) / 2;
    const halfZ = (sin * obj.size.width + cos * obj.size.depth) / 2;

    return {
      id: obj.id,
      minX: obj.position.x - halfX,
      maxX: obj.position.x + halfX,
      minZ: obj.position.z - halfZ,
      maxZ: obj.position.z + halfZ,
    };
  }

  private tagInteractiveHierarchy(root: THREE.Object3D, objectId: string): void {
    root.userData.interactiveObjectId = objectId;
    root.traverse((child) => {
      child.userData.interactiveObjectId = objectId;
    });
  }

  private extractExpectedSequence(room: Room): readonly string[] {
    const puzzle = room.getPuzzle('sequence_puzzle');
    const strategy = puzzle?.getStrategy();
    if (strategy instanceof SequenceStrategy) {
      return strategy.getExpectedSequence();
    }
    return ['B', 'A', 'C'];
  }

  private extractExpectedPin(room: Room): string {
    const puzzle = room.getPuzzle('pin_puzzle');
    const strategy = puzzle?.getStrategy();
    if (strategy instanceof PinCodeStrategy) {
      return strategy.getExpectedPin();
    }
    return '4829';
  }

  private disposeObjectTree(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          for (const mat of node.material) {
            mat.dispose();
          }
        } else {
          node.material.dispose();
        }
      }
    });
  }
}
