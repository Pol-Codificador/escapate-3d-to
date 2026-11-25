/**
 * @pattern Abstract Factory (GoF Creacional)
 * @role ConcreteFactory
 *
 * Problema de diseño que resuelve:
 * Produce la familia completa y coherente de configuraciones visuales, lumínicas,
 * narrativas, sonoras y jugables para la temática "Mansión de Terror" (`'horror'`),
 * garantizando que colores, luces, pistas y estrategias de acertijos pertenezcan
 * al mismo universo sin acoplar el código cliente a clases concretas.
 */

import type {
  IThemeFactory,
  ThemeAudioConfig,
  ThemeColorPalette,
  ThemeGameplayCatalog,
  ThemeLightingConfig,
  ThemeNarrativeConfig,
} from '../../core/interfaces/IThemeFactory';
import { ItemUnlockStrategy } from '../puzzles/strategies/ItemUnlockStrategy';
import { PinCodeStrategy } from '../puzzles/strategies/PinCodeStrategy';
import { SequenceStrategy } from '../puzzles/strategies/SequenceStrategy';

/**
 * Fábrica concreta para la temática Mansión de Terror.
 */
export class HorrorThemeFactory implements IThemeFactory {
  public readonly themeType = 'horror' as const;

  public createColorPalette(): ThemeColorPalette {
    return {
      wallPrimary: 0x241a18,
      wallSecondary: 0x3b2621,
      floor: 0x1a1310,
      ceiling: 0x120d0c,
      furniturePrimary: 0x4a2f24,
      furnitureSecondary: 0x8b6c42,
      interactiveHighlight: 0xff9f43,
      hudAccentCss: '#d97742',
    };
  }

  public createLightingConfig(): ThemeLightingConfig {
    return {
      ambientColor: 0x3a2822,
      ambientIntensity: 0.42,
      mainLightColor: 0xffb36b,
      mainLightIntensity: 1.35,
      accentLightColor: 0x7b2cbf,
      fogColor: 0x110b0a,
      fogDensity: 0.065,
      flickerEnabled: true,
    };
  }

  public createNarrativeConfig(): ThemeNarrativeConfig {
    return {
      themeName: 'Mansión de Terror',
      roomTitle: 'Estudio Sellado de la Mansión Blackwood',
      introText:
        'La tormenta ruge afuera. El portón doble de roble se cerró tras de ti; restaura la energía UV, abre la caja fuerte y encuentra la llave antes de que caiga la medianoche.',
      escapeSuccessMessage:
        '¡Has abierto el portón de roble y escapado de la Mansión Blackwood!',
      timeOutMessage:
        'Las campanadas de medianoche sellaron la mansión para siempre...',
      atmosphereHint:
        'Revisa la nota sobre el escritorio antiguo para restablecer la caja de fusibles.',
    };
  }

  public createAudioConfig(): ThemeAudioConfig {
    return {
      ambientWaveform: 'sawtooth',
      baseDroneFrequencyHz: 55,
      interactionBeepFrequencyHz: 330,
      tensionMultiplier: 1.45,
    };
  }

  public createGameplayCatalog(): ThemeGameplayCatalog {
    return {
      sequencePuzzle: {
        id: 'sequence_puzzle',
        title: 'Caja de Fusibles Oxidados',
        description:
          'Activa los tres interruptores de corriente en el orden exacto indicado en el diario del dueño.',
        strategy: new SequenceStrategy(['B', 'A', 'C']),
      },
      pinPuzzle: {
        id: 'pin_puzzle',
        title: 'Caja Fuerte Antigua',
        description:
          'Introduce la combinación de 4 dígitos revelada bajo la luz ultravioleta.',
        strategy: new PinCodeStrategy('4829'),
      },
      exitPuzzle: {
        id: 'exit_puzzle',
        title: 'Portón Doble de Roble',
        description:
          'Usa la Llave de Bronce en la cerradura principal para liberar el portón.',
        strategy: new ItemUnlockStrategy('bronze_key', 'Llave de Bronce'),
      },
      rewardItem: {
        id: 'bronze_key',
        name: 'Llave de Bronce',
        description:
          'Llave pesada de bronce grabada con el blasón Blackwood. Abre el portón doble de roble.',
        iconType: 'key',
      },
      objects: {
        deskNote: {
          name: 'Nota sobre el Escritorio',
          interactionPrompt: 'Leer nota amarillenta [E]',
          description: 'Una hoja rasgada del diario del antiguo guardián de la mansión.',
          noteContent:
            'Bitácora del Guardián — 31 de Octubre:\n' +
            'La luz ultravioleta de la pared solo encenderá si reactivas los fusibles en el orden correcto:\n' +
            '1° Pulsa el interruptor central (B) para descargar la humedad.\n' +
            '2° Sube el interruptor izquierdo (A) para alimentar la bobina.\n' +
            '3° Cierra el interruptor derecho (C) para completar el circuito.\n' +
            'Orden: B → A → C.',
        },
        switchPanel: {
          name: 'Caja de Fusibles Oxidados',
          interactionPrompt: 'Manipular interruptores (A / B / C) [E]',
          description:
            'Tablero metálico corroído con tres palancas etiquetadas A, B y C.',
          activatedPrompt: 'Caja de fusibles energizada [E]',
          activatedDescription:
            'El circuito B → A → C zumba con estabilidad; la lámpara UV de la pared opuesta está encendida.',
        },
        clueWall: {
          name: 'Cuadro y Pared Ultravioleta',
          interactionPrompt: 'Examinar pared oscura [E]',
          description:
            'Un lienzo apagado frente al escritorio. Parece ocultar tinta invisible bajo una lámpara UV sin energía.',
          noteContent:
            'La superficie del muro está en penumbras; necesitas restaurar primero la energía de la caja de fusibles.',
          activatedPrompt: 'Leer inscripción UV (Código visible) [E]',
          activatedDescription:
            'Bajo el haz ultravioleta brilla un número de cuatro cifras pintado con tinta fosforescente.',
          activatedNoteContent:
            'Inscripción revelada bajo la luz ultravioleta:\n\n' +
            'COMBINACIÓN DE LA CAJA FUERTE: 4829\n\n' +
            'Úsala en la caja fuerte antigua para recuperar la Llave de Bronce.',
        },
        safe: {
          name: 'Caja Fuerte Antigua',
          interactionPrompt: 'Ingresar combinación de 4 dígitos [E]',
          description:
            'Pesada caja fuerte de hierro fundido con teclado numérico de latón.',
          activatedPrompt: 'Caja fuerte abierta [E]',
          activatedDescription:
            'La compuerta de acero está abierta de par en par tras validar la combinación 4829.',
        },
        rewardPickup: {
          name: 'Llave de Bronce',
          interactionPrompt: 'Recoger Llave de Bronce [E]',
          description:
            'Llave antigua de bronce descansando sobre terciopelo rojo junto a la caja fuerte abierta.',
        },
        exitDoor: {
          name: 'Portón Doble de Roble',
          interactionPrompt: 'Usar Llave de Bronce para abrir [E]',
          description:
            'Majestuoso portón doble de roble reforzado con herrajes de hierro. Su cerradura requiere una llave física.',
          activatedPrompt: 'Portón desbloqueado — ¡Escapar! [E]',
          activatedDescription:
            'Los cerrojos cedieron ante la Llave de Bronce y el aire frío del exterior entra en el estudio.',
        },
      },
    };
  }
}
