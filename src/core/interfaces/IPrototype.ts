/**
 * @pattern Prototype (GoF Creacional)
 * @role Prototype Contract
 *
 * Problema de diseño que resuelve:
 * Permite clonar el estado inicial completo de entidades o de la sala configurada
 * sin acoplarse a sus clases concretas ni reconstruir manualmente toda la jerarquía
 * al reiniciar la partida.
 */

/**
 * Contrato genérico para objetos del Modelo capaces de clonarse profundamente.
 *
 * @typeParam T - Tipo concreto devuelto al clonar la instancia.
 */
export interface IPrototype<T> {
  /**
   * Crea y devuelve una copia independiente de la instancia actual.
   *
   * @returns Nueva instancia clonada sin referencias mutables compartidas.
   */
  clone(): T;
}
