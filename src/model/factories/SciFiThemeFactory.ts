/**
 * @pattern Abstract Factory (GoF Creacional)
 * @role ConcreteFactory
 *
 * Problema de diseño que resuelve:
 * Produce la familia completa y coherente de configuraciones visuales, lumínicas,
 * narrativas, sonoras y jugables para la temática "Nave Sci-Fi" (`'scifi'`),
 * garantizando coherencia estética y lógica sin acoplar `RoomDirector` a implementaciones concretas.
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
 * Fábrica concreta para la temática Nave Sci-Fi.
 */
export class SciFiThemeFactory implements IThemeFactory {
  public readonly themeType = 'scifi' as const;

  public createColorPalette(): ThemeColorPalette {
    return {
      wallPrimary: 0x16212e,
      wallSecondary: 0x243b53,
      floor: 0x0f1722,
      ceiling: 0x0b111a,
      furniturePrimary: 0x2f435a,
      furnitureSecondary: 0x00d2ff,
      interactiveHighlight: 0x00f5d4,
      hudAccentCss: '#00d2ff',
    };
  }

  public createLightingConfig(): ThemeLightingConfig {
    return {
      ambientColor: 0x1d3557,
      ambientIntensity: 0.55,
      mainLightColor: 0xd8f3ff,
      mainLightIntensity: 1.5,
      accentLightColor: 0x00f5d4,
      fogColor: 0x071019,
      fogDensity: 0.035,
      flickerEnabled: false,
    };
  }

  public createNarrativeConfig(): ThemeNarrativeConfig {
    return {
      themeName: 'Nave Sci-Fi',
      roomTitle: 'Módulo de Contención — Estación Orbital Aether-9',
      introText:
        'Alerta de despresurización activa. Reinicia los circuitos auxiliares, descifra el proyector holográfico y libera la Tarjeta de Acceso Nivel 5 antes del colapso.',
      escapeSuccessMessage:
        '¡Compuerta presurizada abierta! Has evacuado el módulo orbital a tiempo.',
      timeOutMessage:
        'Soporte vital agotado. La compuerta de emergencia permaneció sellada.',
      atmosphereHint:
        'Consulta el datapad sobre la consola metálica para calibrar los circuitos auxiliares.',
    };
  }

  public createAudioConfig(): ThemeAudioConfig {
    return {
      ambientWaveform: 'sine',
      baseDroneFrequencyHz: 82,
      interactionBeepFrequencyHz: 880,
      tensionMultiplier: 1.25,
    };
  }

  public createGameplayCatalog(): ThemeGameplayCatalog {
    return {
      sequencePuzzle: {
        id: 'sequence_puzzle',
        title: 'Panel de Circuitos Auxiliares',
        description:
          'Enruta los nodos energéticos auxiliares (A, B, C) siguiendo la secuencia de arranque del datapad.',
        strategy: new SequenceStrategy(['C', 'B', 'A']),
      },
      pinPuzzle: {
        id: 'pin_puzzle',
        title: 'Terminal Criogénica',
        description:
          'Ingresa el código de autorización de 4 dígitos proyectado por el holograma.',
        strategy: new PinCodeStrategy('7391'),
      },
      exitPuzzle: {
        id: 'exit_puzzle',
        title: 'Compuerta Presurizada',
        description:
          'Desliza la Tarjeta de Acceso Nivel 5 en el lector biométrico de salida.',
        strategy: new ItemUnlockStrategy(
          'access_card_lv5',
          'Tarjeta de Acceso Nivel 5'
        ),
      },
      rewardItem: {
        id: 'access_card_lv5',
        name: 'Tarjeta de Acceso Nivel 5',
        description:
          'Credencial magnética de alta seguridad para desbloquear la compuerta presurizada.',
        iconType: 'card',
      },
      objects: {
        deskNote: {
          name: 'Datapad en Consola Metálica',
          interactionPrompt: 'Leer datapad técnico [E]',
          description:
            'Tableta táctica acoplada a la consola de ingeniería con el protocolo de reinicio.',
          noteContent:
            'REGISTRO DE INGENIERÍA — PROTOCOLO DE EMERGENCIA:\n' +
            'Para alimentar el proyector holográfico del sector este, activa los circuitos en orden inverso al estándar:\n' +
            '1° Conmuta el nodo C para purgar la sobrecarga.\n' +
            '2° Estabiliza el nodo B como puente térmico.\n' +
            '3° Activa el nodo A para proyectar la clave holográfica.\n' +
            'Secuencia obligatoria: C → B → A.',
        },
        switchPanel: {
          name: 'Panel de Circuitos Auxiliares',
          interactionPrompt: 'Calibrar nodos de circuito (A / B / C) [E]',
          description:
            'Interfaz modular con tres interruptores capacitivos etiquetados A, B y C.',
          activatedPrompt: 'Circuitos auxiliares en línea [E]',
          activatedDescription:
            'Los nodos C → B → A están sincronizados en verde; el proyector holográfico está transmitiendo.',
        },
        clueWall: {
          name: 'Proyector Holográfico de Pared',
          interactionPrompt: 'Inspeccionar proyector apagado [E]',
          description:
            'Emisor holográfico en espera. Requiere energía de los circuitos auxiliares.',
          noteContent:
            'Proyector sin alimentación. Calibra primero el panel de circuitos auxiliares.',
          activatedPrompt: 'Leer código holográfico [E]',
          activatedDescription:
            'Un campo holográfico cian proyecta cuatro dígitos suspendidos en el aire.',
          activatedNoteContent:
            'TRANSMISIÓN HOLOGRÁFICA ACTIVA:\n\n' +
            'CÓDIGO DE TERMINAL CRIOGÉNICA: 7391\n\n' +
            'Introduce este PIN en la terminal criogénica para liberar la Tarjeta de Acceso Nivel 5.',
        },
        safe: {
          name: 'Terminal Criogénica',
          interactionPrompt: 'Ingresar PIN de 4 dígitos [E]',
          description:
            'Cápsula criogénica sellada con teclado numérico holográfico.',
          activatedPrompt: 'Terminal criogénica desbloqueada [E]',
          activatedDescription:
            'Compuerta criogénica abierta tras validar el código 7391.',
        },
        rewardPickup: {
          name: 'Tarjeta de Acceso Nivel 5',
          interactionPrompt: 'Recoger Tarjeta de Acceso Nivel 5 [E]',
          description:
            'Tarjeta inteligente emitida desde la bandeja de la terminal criogénica.',
        },
        exitDoor: {
          name: 'Compuerta Presurizada',
          interactionPrompt: 'Pasar Tarjeta de Acceso Nivel 5 [E]',
          description:
            'Compuerta blindada de titanio con sellado hermético y lector magnético lateral.',
          activatedPrompt: 'Compuerta despresurizada — ¡Evacuar! [E]',
          activatedDescription:
            'Luz verde de evacuación confirmada tras validar la Tarjeta de Acceso Nivel 5.',
        },
      },
    };
  }
}
