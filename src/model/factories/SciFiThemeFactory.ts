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
      ambientColor: 0x3b5978,
      ambientIntensity: 1.05,
      mainLightColor: 0xe6f7ff,
      mainLightIntensity: 1.85,
      accentLightColor: 0x00f5d4,
      fogColor: 0x091522,
      fogDensity: 0.016,
      flickerEnabled: false,
    };
  }

  public createNarrativeConfig(): ThemeNarrativeConfig {
    return {
      themeName: 'Nave Sci-Fi',
      roomTitle: 'Módulo de Contención — Estación Orbital Aether-9',
      introText:
        'Alerta de despresurización activa. Reúne los 3 fragmentos del protocolo de arranque, calibra los circuitos auxiliares, descifra el holograma y libera la Tarjeta Nivel 5 antes del colapso.',
      escapeSuccessMessage:
        '¡Compuerta presurizada abierta! Has evacuado el módulo orbital a tiempo.',
      timeOutMessage:
        'Soporte vital agotado. La compuerta de emergencia permaneció sellada.',
      atmosphereHint:
        'Consulta el datapad del ingeniero sobre la consola metálica para iniciar el diagnóstico.',
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
      deskBoxPuzzle: {
        id: 'desk_box_puzzle',
        title: 'Compartimento de Consola',
        description:
          'Inserta el Chip de Mantenimiento en el compartimento auxiliar junto a la consola.',
        strategy: new ItemUnlockStrategy(
          'service_chip',
          'Chip de Mantenimiento'
        ),
      },
      sequencePuzzle: {
        id: 'sequence_puzzle',
        title: 'Panel de Circuitos Auxiliares',
        description:
          'Enruta los nodos energéticos (A, B, C) con la secuencia de 5 pasos reconstruida de los registros.',
        strategy: new SequenceStrategy(['C', 'B', 'A', 'C', 'B']),
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
      initialItem: {
        id: 'service_chip',
        name: 'Chip de Mantenimiento',
        description:
          'Módulo de diagnóstico electrónico hallado en la estación de carga. Libera el compartimento de consola.',
        iconType: 'tool',
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
          name: 'Datapad del Ingeniero',
          interactionPrompt: 'Leer datapad del ingeniero [E]',
          description:
            'Tableta táctica acoplada a la consola de ingeniería con la primera parte del protocolo.',
          noteContent:
            'DATAPAD DEL INGENIERO — FRAGMENTO #1 DE 3:\n' +
            'El proyector holográfico del mamparo este requiere una secuencia de 5 pulsos.\n' +
            'Pasos iniciales del arranque:\n' +
            '• Paso 1: Nodo C (purga de sobrecarga)\n' +
            '• Paso 2: Nodo B (puente térmico)\n' +
            'Inicio: C → B → ...\n\n' +
            'Aviso de turno: Los pasos 3 y 4 están respaldados en el Compartimento de Consola lateral. ' +
            'Dejé el Chip de Mantenimiento en el estante de herramientas del sector noroeste.',
        },
        smallKeyPickup: {
          name: 'Chip de Mantenimiento',
          interactionPrompt: 'Recoger Chip de Mantenimiento [E]',
          description:
            'Chip de servicio con pines dorados descansando sobre la estación de carga.',
        },
        deskBox: {
          name: 'Compartimento de Consola',
          interactionPrompt: 'Desbloquear compartimento de consola [E]',
          description:
            'Módulo blindado junto a la consola principal. Requiere el Chip de Mantenimiento.',
          noteContent:
            'Compartimento bloqueado por protocolo técnico. Inserta el Chip de Mantenimiento ubicado en la estación de herramientas.',
          activatedPrompt: 'Leer respaldo de consola [E]',
          activatedDescription:
            'Compuerta de servicio abierta; la pantalla interna muestra el segundo fragmento del protocolo.',
          activatedNoteContent:
            'RESPALDO DE CONSOLA — FRAGMENTO #2 DE 3:\n' +
            'Continuación de la secuencia de nodos (pasos 3 y 4):\n' +
            '• Paso 3: Nodo A (estabilización de fase)\n' +
            '• Paso 4: Nodo C (realimentación de flujo)\n' +
            'Tramo intermedio: ... → A → C → ...\n\n' +
            'El paso 5 quedó marcado en el Panel de Advertencia del mamparo sur.',
        },
        wallMarking: {
          name: 'Panel de Advertencia en Mamparo',
          interactionPrompt: 'Inspeccionar panel rallado del mamparo [E]',
          description:
            'Placa técnica rallada sobre el mamparo sur con marcas de emergencia grabadas por la tripulación.',
          noteContent:
            'PANEL DE ADVERTENCIA — FRAGMENTO #3 DE 3:\n' +
            '«PROTOCOLO MANUAL DE CIERRE:\n' +
            '• Paso 5: → B (cierra la calibración de cinco ciclos).»\n\n' +
            'Ingresa los 5 pasos completos en el Panel de Circuitos Auxiliares.',
        },
        switchPanel: {
          name: 'Panel de Circuitos Auxiliares',
          interactionPrompt: 'Abrir panel de circuitos (5 pasos: A / B / C) [E]',
          description:
            'Interfaz modular con tres interruptores capacitivos (A, B, C) y barra de 5 ciclos.',
          activatedPrompt: 'Circuitos auxiliares en línea [E]',
          activatedDescription:
            'Los 5 ciclos (C → B → A → C → B) están sincronizados en verde; el proyector holográfico está transmitiendo.',
        },
        clueWall: {
          name: 'Proyector Holográfico de Pared',
          interactionPrompt: 'Inspeccionar proyector apagado [E]',
          description:
            'Emisor holográfico en espera. Requiere completar los 5 pasos en los circuitos auxiliares.',
          noteContent:
            'Proyector sin alimentación. Calibra primero los 5 nodos del panel de circuitos auxiliares.',
          activatedPrompt: 'Leer código holográfico [E]',
          activatedDescription:
            'Un campo holográfico cian proyecta cuatro dígitos suspendidos en el aire.',
          activatedNoteContent:
            'TRANSMISIÓN HOLOGRÁFICA ACTIVA:\n\n' +
            'CÓDIGO DE TERMINAL CRIOGÉNICA: 7391\n\n' +
            'Introduce este PIN en la Terminal Criogénica para liberar la Tarjeta de Acceso Nivel 5.',
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
