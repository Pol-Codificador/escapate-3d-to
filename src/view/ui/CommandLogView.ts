/**
 * @pattern MVC (Vista HTML/CSS) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Observa directamente al `CommandInvoker` (`IObserver<CommandHistorySnapshot>`) para
 * renderizar en tiempo real el panel lateral desplegable (tecla `H`) con cada comando
 * ejecutado, su hora exacta y estado (`Ejecutado`, `Reversible` o `Deshecho`).
 */

import type {
  CommandHistorySnapshot,
} from '../../controller/commands/CommandInvoker';
import type { IObserver } from '../../core/interfaces/IObserver';

/**
 * Panel lateral observable para auditar en vivo el patrón Command.
 */
export class CommandLogView implements IObserver<CommandHistorySnapshot> {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLUListElement;
  private readonly countEl: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly onUndoCallback: () => void;
  private readonly onToggleCallback?: (isOpen: boolean) => void;

  private isOpenState: boolean;

  constructor(
    container: HTMLElement,
    onUndo: () => void,
    onToggle?: (isOpen: boolean) => void
  ) {
    this.onUndoCallback = onUndo;
    this.onToggleCallback = onToggle;
    this.isOpenState = false;

    this.root = document.createElement('aside');
    this.root.className = 'command-log-drawer hidden';
    this.root.setAttribute('aria-label', 'Historial de Comandos');

    this.root.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-kicker">Patrón Command · Observer</span>
          <h2 class="drawer-title">Historial de Acciones</h2>
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" title="Cerrar (H)">✕</button>
      </div>
      <div class="drawer-toolbar">
        <span class="drawer-count" data-role="count">0 comandos</span>
        <button type="button" class="drawer-undo-btn" data-action="undo" disabled>
          Deshacer último (Z)
        </button>
      </div>
      <ul class="command-log-list" data-role="list">
        <li class="command-log-empty">Aún no se han ejecutado comandos en esta sala.</li>
      </ul>
    `;

    container.appendChild(this.root);

    const listEl = this.root.querySelector<HTMLUListElement>('[data-role="list"]');
    const countEl = this.root.querySelector<HTMLElement>('[data-role="count"]');
    const undoBtn = this.root.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const closeBtn = this.root.querySelector<HTMLButtonElement>('[data-action="close"]');

    if (!listEl || !countEl || !undoBtn || !closeBtn) {
      throw new Error('CommandLogView: faltan elementos requeridos del DOM.');
    }

    this.listEl = listEl;
    this.countEl = countEl;
    this.undoBtn = undoBtn;
    this.closeBtn = closeBtn;

    this.undoBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onUndoCallback();
    });
    this.closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.setOpen(false);
    });
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public toggle(): boolean {
    return this.setOpen(!this.isOpenState);
  }

  public setOpen(open: boolean): boolean {
    this.isOpenState = open;
    this.root.classList.toggle('hidden', !open);
    this.onToggleCallback?.(open);
    return this.isOpenState;
  }

  public update(snapshot: CommandHistorySnapshot): void {
    const entries = snapshot.entries;
    this.countEl.textContent = `${entries.length} ${entries.length === 1 ? 'comando' : 'comandos'}`;

    const hasReversible = entries.some((entry) => entry.reversible && !entry.undone);
    this.undoBtn.disabled = !hasReversible;

    if (entries.length === 0) {
      this.listEl.innerHTML =
        '<li class="command-log-empty">Aún no se han ejecutado comandos en esta sala.</li>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const reversed = [...entries].reverse();

    for (const entry of reversed) {
      const li = document.createElement('li');
      li.className = 'command-log-item';
      if (entry.undone) {
        li.classList.add('undone');
      } else if (entry.reversible) {
        li.classList.add('reversible');
      }

      const statusText = entry.undone
        ? 'Deshecho'
        : entry.reversible
          ? 'Reversible'
          : 'Ejecutado';

      const header = document.createElement('div');
      header.className = 'command-item-top';

      const nameEl = document.createElement('span');
      nameEl.className = 'command-item-name';
      nameEl.textContent = `#${entry.id} · ${entry.commandName}`;

      const timeEl = document.createElement('span');
      timeEl.className = 'command-item-time';
      timeEl.textContent = entry.formattedTime;

      header.append(nameEl, timeEl);

      const descEl = document.createElement('p');
      descEl.className = 'command-item-desc';
      descEl.textContent = entry.description;

      const badgeEl = document.createElement('span');
      badgeEl.className = 'command-item-badge';
      badgeEl.textContent = statusText;

      li.append(header, descEl, badgeEl);
      fragment.appendChild(li);
    }

    this.listEl.innerHTML = '';
    this.listEl.appendChild(fragment);
  }

  public dispose(): void {
    this.root.remove();
  }
}
