/**
 * @pattern Command (GoF Comportamental)
 * @role Command Contract
 *
 * Problema de diseño que resuelve:
 * Encapsula cada interacción del jugador (inspeccionar, accionar interruptor,
 * ingresar código, recoger o usar un ítem) como un objeto autónomo. Esto permite
 * al Controlador ejecutar acciones sin acoplarse a detalles de cada receptor,
 * mantener un historial de comandos y soportar reversión mediante `undo()`.
 */

/**
 * Contrato base para todos los comandos ejecutables y reversibles del juego.
 */
export interface ICommand {
  /**
   * Ejecuta la acción encapsulada sobre el receptor correspondiente del Modelo.
   */
  execute(): void;

  /**
   * Revierte los efectos provocados por `execute()` cuando la acción es reversible.
   */
  undo(): void;

  /**
   * Devuelve una descripción legible de la acción para historial, depuración o HUD.
   *
   * @returns Texto breve describiendo el comando ejecutado.
   */
  getDescription(): string;
}
