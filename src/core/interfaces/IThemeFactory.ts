/**
 * @pattern Abstract Factory (GoF Creacional)
 * @role AbstractFactory & AbstractProduct Contracts
 *
 * Problema de diseño que resuelve:
 * Permite crear familias completas y coherentes de configuraciones (paleta cromática,
 * iluminación, narrativa, audio y catálogo jugable de acertijos y objetos) según la
 * temática elegida ('horror' o 'scifi') sin que el Modelo ni la Vista dependan de
 * clases concretas ni importen Three.js en la capa de contratos o lógica pura.
 */

import type { IPuzzleValidationStrategy } from './IPuzzleValidationStrategy';

/**
 * Temáticas oficiales soportadas por el Escape Room.
 */
export type ThemeType = 'horror' | 'scifi';

/**
 * Categorías visuales puras de íconos para ítems coleccionables.
 */
export type ThemeItemIconType = 'key' | 'card' | 'note' | 'tool' | 'artifact';

/**
 * Producto abstracto: paleta cromática pura (valores hexadecimales numéricos y CSS)
 * independiente de Three.js.
 */
export interface ThemeColorPalette {
  /** Color base de paredes en formato hexadecimal numérico (ej. `0x1c1816`). */
  readonly wallPrimary: number;
  /** Color secundario de molduras o paneles de pared. */
  readonly wallSecondary: number;
  /** Color base del suelo. */
  readonly floor: number;
  /** Color base del techo. */
  readonly ceiling: number;
  /** Color principal para mobiliario estructural. */
  readonly furniturePrimary: number;
  /** Color secundario o metálico para detalles de mobiliario. */
  readonly furnitureSecondary: number;
  /** Color emisivo de resaltado al apuntar objetos interactivos. */
  readonly interactiveHighlight: number;
  /** Color de acento en formato CSS para el HUD HTML/CSS. */
  readonly hudAccentCss: string;
}

/**
 * Producto abstracto: parámetros puros de iluminación y atmósfera de sala.
 */
export interface ThemeLightingConfig {
  readonly ambientColor: number;
  readonly ambientIntensity: number;
  readonly mainLightColor: number;
  readonly mainLightIntensity: number;
  readonly accentLightColor: number;
  readonly fogColor: number;
  readonly fogDensity: number;
  /** Indica si la iluminación principal presenta parpadeo atmosférico. */
  readonly flickerEnabled: boolean;
}

/**
 * Producto abstracto: textos narrativos y de ambientación por temática.
 */
export interface ThemeNarrativeConfig {
  readonly themeName: string;
  readonly roomTitle: string;
  readonly introText: string;
  readonly escapeSuccessMessage: string;
  readonly timeOutMessage: string;
  readonly atmosphereHint: string;
}

/**
 * Producto abstracto: parámetros de síntesis sonora procedural (Web Audio API en la Vista).
 */
export interface ThemeAudioConfig {
  readonly ambientWaveform: 'sine' | 'sawtooth' | 'triangle' | 'square';
  readonly baseDroneFrequencyHz: number;
  readonly interactionBeepFrequencyHz: number;
  readonly tensionMultiplier: number;
}

/**
 * Especificación abstracta de un ítem coleccionable producido por la fábrica temática.
 */
export interface ThemeRewardItemSpec {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly iconType: ThemeItemIconType;
}

/**
 * Especificación abstracta de un acertijo temático junto con su estrategia de validación.
 */
export interface ThemePuzzleSpec {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly strategy: IPuzzleValidationStrategy;
}

/**
 * Especificación textual de un elemento interactuable de la sala temática.
 */
export interface ThemeObjectTextSpec {
  readonly name: string;
  readonly interactionPrompt: string;
  readonly description: string;
  readonly activatedPrompt?: string;
  readonly activatedDescription?: string;
  readonly noteContent?: string;
  readonly activatedNoteContent?: string;
}

/**
 * Producto abstracto: catálogo jugable coherente de acertijos, pistas, objetos e ítems
 * para construir una sala completa sin condicionales sobre la temática.
 */
export interface ThemeGameplayCatalog {
  readonly sequencePuzzle: ThemePuzzleSpec;
  readonly pinPuzzle: ThemePuzzleSpec;
  readonly exitPuzzle: ThemePuzzleSpec;
  readonly rewardItem: ThemeRewardItemSpec;
  readonly objects: {
    readonly deskNote: ThemeObjectTextSpec;
    readonly switchPanel: ThemeObjectTextSpec;
    readonly clueWall: ThemeObjectTextSpec;
    readonly safe: ThemeObjectTextSpec;
    readonly rewardPickup: ThemeObjectTextSpec;
    readonly exitDoor: ThemeObjectTextSpec;
  };
}

/**
 * Fábrica abstracta encargada de producir la familia coherente de configuraciones
 * visuales, lumínicas, narrativas, sonoras y jugables para una temática específica.
 */
export interface IThemeFactory {
  /** Identificador de la temática producida por la fábrica concreta. */
  readonly themeType: ThemeType;

  /** Crea la paleta de colores de la temática. */
  createColorPalette(): ThemeColorPalette;

  /** Crea la configuración de iluminación y niebla de la temática. */
  createLightingConfig(): ThemeLightingConfig;

  /** Crea los textos narrativos y títulos de la temática. */
  createNarrativeConfig(): ThemeNarrativeConfig;

  /** Crea la configuración base de audio procedural de la temática. */
  createAudioConfig(): ThemeAudioConfig;

  /** Crea el catálogo jugable completo (acertijos, estrategias, pistas e ítem). */
  createGameplayCatalog(): ThemeGameplayCatalog;
}
