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
      ambientColor: 0x5c4338,
      ambientIntensity: 0.92,
      mainLightColor: 0xffbe76,
      mainLightIntensity: 1.75,
      accentLightColor: 0x9d4edd,
      fogColor: 0x1a1210,
      fogDensity: 0.02,
      flickerEnabled: true,
    };
  }

  public createNarrativeConfig(): ThemeNarrativeConfig {
    return {
      themeName: 'Mansión de Terror',
      roomTitle: 'Estudio Sellado de la Mansión Blackwood',
      introText:
        'La tormenta ruge afuera. El portón doble de roble se cerró tras de ti; reúne las 3 pistas del circuito de fusibles, enciende la luz UV, abre la caja fuerte y encuentra la llave antes de la medianoche.',
      escapeSuccessMessage:
        '¡Has abierto el portón de roble y escapado de la Mansión Blackwood!',
      timeOutMessage:
        'Las campanadas de medianoche sellaron la mansión para siempre...',
      atmosphereHint:
        'Lee la bitácora del guardián sobre el escritorio para iniciar la búsqueda de pistas.',
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
      deskBoxPuzzle: {
        id: 'desk_box_puzzle',
        title: 'Cofre Lacrado del Escritorio',
        description:
          'Abre el cofre cerrado junto al escritorio usando la Llave Pequeña de Latón.',
        strategy: new ItemUnlockStrategy(
          'brass_drawer_key',
          'Llave Pequeña de Latón'
        ),
      },
      sequencePuzzle: {
        id: 'sequence_puzzle',
        title: 'Caja de Fusibles Oxidados',
        description:
          'Activa los tres interruptores en la secuencia de 5 pulsos obtenida tras unir las 3 pistas de la sala.',
        strategy: new SequenceStrategy(['B', 'A', 'C', 'B', 'A']),
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
      initialItem: {
        id: 'brass_drawer_key',
        name: 'Llave Pequeña de Latón',
        description:
          'Pequeña llave labrada en latón hallada en la estantería antigua. Abre el cofre cerrado junto al escritorio.',
        iconType: 'key',
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
          name: 'Bitácora del Guardián',
          interactionPrompt: 'Leer bitácora del guardián [E]',
          description:
            'Diario encuadernado en cuero con el inicio del protocolo ultravioleta.',
          noteContent:
            'BITÁCORA DEL GUARDIÁN — PISTA #1 DE 3:\n' +
            'La lámpara UV de la pared este exige una secuencia de 5 pulsos eléctricos.\n' +
            'Logré anotar los dos primeros antes de que la tormenta apagara las velas:\n' +
            '• Paso 1: Interruptor B (descarga inicial)\n' +
            '• Paso 2: Interruptor A (alimentación de bobina)\n' +
            'Inicio: B → A → ...\n\n' +
            'Nota al margen: Guardé los pasos 3 y 4 dentro del cofre cerrado junto al escritorio. ' +
            'La Llave Pequeña de Latón quedó olvidada en la estantería alta de libros, al fondo noroeste.',
        },
        smallKeyPickup: {
          name: 'Llave Pequeña de Latón',
          interactionPrompt: 'Recoger Llave Pequeña de Latón [E]',
          description:
            'Llave diminuta de latón antiguo apoyada entre los tomos polvorientos de la estantería.',
        },
        deskBox: {
          name: 'Caja del Escritorio',
          interactionPrompt: 'Abrir caja cerrada del escritorio [E]',
          description:
            'Cofre de roble y herrajes de latón cerrado con llave. Requiere la Llave Pequeña de Latón.',
          noteContent:
            'El cofre está cerrado con una pequeña cerradura de latón. Busca la Llave Pequeña de Latón en la estantería del fondo.',
          activatedPrompt: 'Leer nota arrancada del cofre [E]',
          activatedDescription:
            'La tapa cedió con un chasquido metálico revelando una hoja arrancada en su interior.',
          activatedNoteContent:
            'NOTA ARRANCADA — PISTA #2 DE 3:\n' +
            'Continuación del circuito UV (pasos 3 y 4):\n' +
            '• Paso 3: Interruptor C (cierre auxiliar)\n' +
            '• Paso 4: Interruptor B (retorno de fase)\n' +
            'Tramo intermedio: ... → C → B → ...\n\n' +
            'El quinto y último pulso quedó grabado con tiza y cuchillo sobre el muro sur, frente al portón.',
        },
        wallMarking: {
          name: 'Inscripción en la Pared',
          interactionPrompt: 'Examinar inscripción en el muro [E]',
          description:
            'Rasguños profundos y trazos de tiza carmesí sobre el papel tapiz desgarrado del muro sur.',
          noteContent:
            'INSCRIPCIÓN EN LA PARED — PISTA #3 DE 3:\n' +
            '«Cuando el cuarto pulso termine en B, no olvides el quinto:\n' +
            '• Paso 5: → A (cierra el ciclo donde empezó el segundo pulso).»\n\n' +
            'Reúne las tres pistas para completar los 5 movimientos en la Caja de Fusibles.',
        },
        switchPanel: {
          name: 'Caja de Fusibles Oxidados',
          interactionPrompt: 'Abrir panel de fusibles (5 pasos: A / B / C) [E]',
          description:
            'Tablero metálico corroído con tres palancas (A, B, C) y cinco indicadores de pulso.',
          activatedPrompt: 'Caja de fusibles energizada [E]',
          activatedDescription:
            'El circuito de 5 pasos (B → A → C → B → A) zumba con estabilidad; la lámpara UV de la pared este está encendida.',
        },
        clueWall: {
          name: 'Cuadro y Pared Ultravioleta',
          interactionPrompt: 'Examinar pared oscura [E]',
          description:
            'Un lienzo apagado en el muro este. Oculta tinta invisible bajo una lámpara UV sin energía.',
          noteContent:
            'La superficie del muro está en penumbras; restaura primero los 5 pulsos en la Caja de Fusibles.',
          activatedPrompt: 'Leer inscripción UV (Código visible) [E]',
          activatedDescription:
            'Bajo el haz ultravioleta brilla un número de cuatro cifras pintado con tinta fosforescente.',
          activatedNoteContent:
            'INSCRIPCIÓN REVELADA BAJO LUZ ULTRAVIOLETA:\n\n' +
            'COMBINACIÓN DE LA CAJA FUERTE: 4829\n\n' +
            'Introduce este código en la Caja Fuerte Antigua para recuperar la Llave de Bronce.',
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
