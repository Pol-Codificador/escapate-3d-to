/**
 * @pattern Observer (GoF Comportamental)
 * @role Observer & Subject Contracts
 *
 * Problema de diseño que resuelve:
 * Permite desacoplar completamente la lógica del Modelo (temporizador, inventario,
 * estado de acertijos) de sus múltiples consumidores en la Vista (HUD HTML/CSS,
 * iluminación 3D, puerta de salida, audio). El Modelo notifica cambios de estado
 * sin conocer qué objetos concretos reaccionan ni depender de Three.js o del DOM.
 */

/**
 * Contrato genérico para cualquier observador que reacciona a notificaciones de un sujeto.
 *
 * @typeParam T - Tipo de dato o instantánea de estado emitida por el sujeto.
 */
export interface IObserver<T> {
  /**
   * Recibe una actualización emitida por el sujeto observado.
   *
   * @param data - Estado actualizado emitido por el sujeto.
   */
  update(data: T): void;
}

/**
 * Contrato genérico para sujetos observables del Modelo.
 *
 * @typeParam T - Tipo de dato o instantánea de estado emitida a los observadores.
 */
export interface ISubject<T> {
  /**
   * Suscribe un observador para recibir futuras notificaciones de cambio.
   *
   * @param observer - Instancia que implementa `IObserver<T>`.
   */
  attach(observer: IObserver<T>): void;

  /**
   * Cancela la suscripción de un observador previamente registrado.
   *
   * @param observer - Instancia a desuscribir.
   */
  detach(observer: IObserver<T>): void;

  /**
   * Notifica a todos los observadores suscritos enviando el estado actual.
   *
   * @param data - Instantánea de estado que se difunde a los observadores.
   */
  notify(data: T): void;
}
