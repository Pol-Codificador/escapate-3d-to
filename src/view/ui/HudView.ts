/**
 * @pattern MVC (Vista HTML/CSS) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Renderiza el HUD completo en pantalla (barra superior con reloj `MM:SS`, progreso `X/4`,
 * temática y controles rápidos; mira central + cartel `[E]`; barra inferior de inventario
 * visual con íconos SVG; y notificaciones tipo toast) observando de forma desacoplada a
 * `GameTimer`, `Inventory`, `GameManager`, `Room` y `CommandInvoker`.
 */

import type { CommandHistorySnapshot } from '../../controller/commands/CommandInvoker';
import type { HoverTargetInfo } from '../../controller/GameController';
import type { IObserver } from '../../core/interfaces/IObserver';
import type { ThemeItemIconType } from '../../core/interfaces/IThemeFactory';
import type { GameStateSnapshot } from '../../core/singletons/GameManager';
import type { InventorySnapshot } from '../../model/entities/Inventory';
import type { InventoryItem } from '../../model/entities/InventoryItem';
import type { RoomSnapshot } from '../../model/entities/Room';
import type { TimerSnapshot } from '../../model/GameTimer';

export type HudObservedSnapshot =
  | TimerSnapshot
  | InventorySnapshot
  | GameStateSnapshot
  | RoomSnapshot
  | CommandHistorySnapshot;

/**
 * Callbacks de botones del HUD hacia el Controlador / coordinador UI.
 */
export interface HudActionsCallbacks {
  readonly onToggleMute: () => boolean;
  readonly onToggleFlashlight: () => boolean;
  readonly onToggleHistory: () => void;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
  readonly onReturnMenu: () => void;
  readonly onSelectSlot: (slotIndex: number) => void;
}

/**
 * Vista HUD principal en HTML/CSS puro.
 */
export class HudView implements IObserver<HudObservedSnapshot> {
  private readonly root: HTMLElement;
  private readonly callbacks: HudActionsCallbacks;

  private readonly themeBadgeEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly flashlightBtn: HTMLButtonElement;
  private readonly historyBtn: HTMLButtonElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly restartBtn: HTMLButtonElement;
  private readonly menuBtn: HTMLButtonElement;

  private readonly pointerBannerEl: HTMLElement;
  private readonly crosshairEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private readonly inventoryBarEl: HTMLElement;
  private readonly toastStackEl: HTMLElement;

  private isPointerLocked: boolean;
  private isModalOpen: boolean;
  private isPlaying: boolean;

  constructor(container: HTMLElement, callbacks: HudActionsCallbacks) {
    this.callbacks = callbacks;
    this.isPointerLocked = false;
    this.isModalOpen = false;
    this.isPlaying = false;

    this.root = document.createElement('div');
    this.root.className = 'hud-overlay hidden';

    this.root.innerHTML = `
      <header class="hud-top-bar">
        <div class="hud-top-left">
          <span class="hud-theme-badge" data-role="theme-badge">Mansión de Terror</span>
          <div class="hud-timer" data-role="timer">05:00</div>
          <div class="hud-progress" data-role="progress">Acertijos: 0 / 4</div>
        </div>
        <div class="hud-top-actions">
          <button type="button" class="hud-btn" data-action="mute" title="Silenciar / Activar Audio (M)">
            Audio (M)
          </button>
          <button type="button" class="hud-btn active" data-action="flashlight" title="Alternar Linterna (F)">
            Linterna (F)
          </button>
          <button type="button" class="hud-btn" data-action="history" title="Historial de Comandos (H)">
            Historial (H)
          </button>
          <button type="button" class="hud-btn" data-action="undo" title="Deshacer último paso (Z)" disabled>
            Deshacer (Z)
          </button>
          <button type="button" class="hud-btn" data-action="restart" title="Reiniciar Sala (R)">
            Reiniciar (R)
          </button>
          <button type="button" class="hud-btn hud-btn--danger" data-action="menu" title="Volver al Menú">
            Menú
          </button>
        </div>
      </header>

      <div class="hud-toast-stack" data-role="toasts"></div>

      <div class="hud-pointer-banner" data-role="pointer-banner">
        Haz clic en la escena para mirar en 1ra persona (ESC libera el cursor)
      </div>

      <div class="hud-crosshair" data-role="crosshair" aria-hidden="true">+</div>

      <div class="hud-bottom-dock">
        <div class="hud-interaction-prompt hidden" data-role="prompt"></div>
        <div class="hud-inventory-bar" data-role="inventory"></div>
      </div>
    `;

    container.appendChild(this.root);

    this.themeBadgeEl = this.requireElement('[data-role="theme-badge"]');
    this.timerEl = this.requireElement('[data-role="timer"]');
    this.progressEl = this.requireElement('[data-role="progress"]');
    this.muteBtn = this.requireElement<HTMLButtonElement>('[data-action="mute"]');
    this.flashlightBtn = this.requireElement<HTMLButtonElement>('[data-action="flashlight"]');
    this.historyBtn = this.requireElement<HTMLButtonElement>('[data-action="history"]');
    this.undoBtn = this.requireElement<HTMLButtonElement>('[data-action="undo"]');
    this.restartBtn = this.requireElement<HTMLButtonElement>('[data-action="restart"]');
    this.menuBtn = this.requireElement<HTMLButtonElement>('[data-action="menu"]');
    this.pointerBannerEl = this.requireElement('[data-role="pointer-banner"]');
    this.crosshairEl = this.requireElement('[data-role="crosshair"]');
    this.promptEl = this.requireElement('[data-role="prompt"]');
    this.inventoryBarEl = this.requireElement('[data-role="inventory"]');
    this.toastStackEl = this.requireElement('[data-role="toasts"]');

    this.bindButtonListeners();
    this.renderInventorySlots([], 5, 0);
  }

  public setPointerLocked(locked: boolean): void {
    this.isPointerLocked = locked;
    this.refreshPointerBannerVisibility();
  }

  public setModalOpen(open: boolean): void {
    this.isModalOpen = open;
    this.refreshPointerBannerVisibility();
  }

  public syncMuteState(muted: boolean): void {
    this.muteBtn.textContent = muted ? 'Audio Off (M)' : 'Audio (M)';
    this.muteBtn.classList.toggle('muted', muted);
  }

  public syncFlashlightState(on: boolean): void {
    this.flashlightBtn.textContent = on ? 'Linterna On (F)' : 'Linterna Off (F)';
    this.flashlightBtn.classList.toggle('active', on);
  }

  public syncHistoryState(open: boolean): void {
    this.historyBtn.classList.toggle('active', open);
  }

  public renderHover(hover: HoverTargetInfo | null, isSequenceSolved: boolean): void {
    if (!hover || !this.isPlaying || this.isModalOpen) {
      this.crosshairEl.classList.remove('active');
      this.promptEl.classList.add('hidden');
      this.promptEl.textContent = '';
      return;
    }

    this.crosshairEl.classList.add('active');
    this.promptEl.classList.remove('hidden');

    if (hover.object.kind === 'switch_panel' && !isSequenceSolved) {
      this.promptEl.textContent = `[E / Click] ${hover.object.interactionPrompt}`;
      return;
    }

    this.promptEl.textContent = hover.object.interactionPrompt;
  }

  public showToast(
    message: string,
    variant: 'info' | 'success' | 'warning' = 'info'
  ): void {
    if (!message.trim()) {
      return;
    }

    const toast = document.createElement('div');
    toast.className = `hud-toast hud-toast--${variant}`;
    toast.textContent = message;

    this.toastStackEl.appendChild(toast);
    while (this.toastStackEl.children.length > 3) {
      this.toastStackEl.firstElementChild?.remove();
    }

    window.setTimeout(() => {
      toast.classList.add('fading');
      window.setTimeout(() => {
        toast.remove();
      }, 240);
    }, 3200);
  }

  public update(snapshot: HudObservedSnapshot): void {
    if ('remainingSeconds' in snapshot) {
      this.timerEl.textContent = snapshot.formattedTime;
      const critical = snapshot.isCritical && snapshot.isRunning && !snapshot.isExpired;
      this.timerEl.classList.toggle('critical', critical);
      return;
    }

    if ('selectedSlotIndex' in snapshot) {
      this.renderInventorySlots(
        snapshot.items,
        snapshot.maxSlots,
        snapshot.selectedSlotIndex
      );
      if (snapshot.eventType === 'item_added' && snapshot.lastChangedItem) {
        this.showToast(
          `Recogido: ${snapshot.lastChangedItem.name}`,
          'success'
        );
      }
      return;
    }

    if ('entries' in snapshot) {
      const hasReversible = snapshot.entries.some(
        (entry) => entry.reversible && !entry.undone
      );
      this.undoBtn.disabled = !hasReversible;

      if (snapshot.eventType === 'undone') {
        this.showToast(`Paso revertido (Command.undo): ${snapshot.lastEntry?.description ?? ''}`, 'warning');
      }
      return;
    }

    if ('isExitOpen' in snapshot) {
      this.progressEl.textContent = `Acertijos: ${snapshot.solvedPuzzleIds.length} / ${snapshot.totalPuzzles}`;
      if (snapshot.lastEventMessage) {
        const lower = snapshot.lastEventMessage.toLowerCase();
        const variant =
          lower.includes('incorrect') ||
          lower.includes('necesitas') ||
          lower.includes('denegado') ||
          lower.includes('bloqueada')
            ? 'warning'
            : lower.includes('desbloqueado') ||
                lower.includes('correcta') ||
                lower.includes('aceptado') ||
                lower.includes('liberado')
              ? 'success'
              : 'info';
        if (variant !== 'info' || snapshot.isExitOpen) {
          this.showToast(snapshot.lastEventMessage, variant);
        }
      }
      return;
    }

    if ('lifecycleState' in snapshot) {
      this.isPlaying = snapshot.lifecycleState === 'playing';
      const showHud = snapshot.lifecycleState !== 'menu';
      this.root.classList.toggle('hidden', !showHud);

      if (snapshot.themeType) {
        this.root.dataset.theme = snapshot.themeType;
        this.themeBadgeEl.textContent =
          snapshot.themeType === 'scifi' ? 'Nave Sci-Fi' : 'Mansión de Terror';
      }

      this.timerEl.textContent = snapshot.remainingFormattedTime;
      this.progressEl.textContent = `Acertijos: ${snapshot.solvedCount} / ${snapshot.totalPuzzles}`;
      this.refreshPointerBannerVisibility();
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private bindButtonListeners(): void {
    this.muteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const muted = this.callbacks.onToggleMute();
      this.syncMuteState(muted);
      this.showToast(muted ? 'Audio silenciado' : 'Audio activado', 'info');
    });

    this.flashlightBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const on = this.callbacks.onToggleFlashlight();
      this.syncFlashlightState(on);
    });

    this.historyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onToggleHistory();
    });

    this.undoBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onUndo();
    });

    this.restartBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onRestart();
      this.showToast('Sala reiniciada desde Prototype', 'info');
    });

    this.menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onReturnMenu();
    });
  }

  private refreshPointerBannerVisibility(): void {
    const shouldShow = this.isPlaying && !this.isPointerLocked && !this.isModalOpen;
    this.pointerBannerEl.classList.toggle('hidden', !shouldShow);
  }

  private renderInventorySlots(
    items: readonly InventoryItem[],
    maxSlots: number,
    selectedSlotIndex: number
  ): void {
    this.inventoryBarEl.innerHTML = '';

    for (let i = 0; i < maxSlots; i += 1) {
      const item = items[i] ?? null;
      const slotBtn = document.createElement('button');
      slotBtn.type = 'button';
      slotBtn.className = 'inventory-slot';
      if (i === selectedSlotIndex) {
        slotBtn.classList.add('selected');
      }
      if (!item) {
        slotBtn.classList.add('empty');
      }

      slotBtn.title = item
        ? `${item.name}: ${item.description}`
        : `Ranura ${i + 1} vacía`;

      const keyNum = document.createElement('span');
      keyNum.className = 'slot-number';
      keyNum.textContent = String(i + 1);

      const iconWrap = document.createElement('span');
      iconWrap.className = 'slot-icon';
      iconWrap.innerHTML = item ? this.buildItemSvg(item.iconType, item.id) : '';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = item ? item.name : 'Vacío';

      slotBtn.append(keyNum, iconWrap, label);
      slotBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSelectSlot(i);
      });

      this.inventoryBarEl.appendChild(slotBtn);
    }
  }

  private buildItemSvg(iconType: ThemeItemIconType, itemId: string): string {
    if (iconType === 'key') {
      const stroke = itemId === 'brass_drawer_key' ? '#ffd166' : '#f4a261';
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`;
    }

    if (iconType === 'tool') {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#00f5d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>`;
    }

    if (iconType === 'card') {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>`;
    }

    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e9c46a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }

  private requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`HudView: no se encontró el elemento ${selector}`);
    }
    return el;
  }
}
