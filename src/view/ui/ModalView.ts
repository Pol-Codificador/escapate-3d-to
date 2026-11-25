/**
 * @pattern MVC (Vista HTML/CSS) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Centraliza los modales interactivos en primer plano (Lectura de pistas, Panel de 5
 * palancas, Teclado numérico de caja fuerte/terminal y Pantalla de Victoria/Derrota),
 * liberando el Pointer Lock al abrirse y retomando la exploración FPS al cerrarse,
 * delegando todas las acciones de escritura exclusivamente en `GameController`.
 */

import type { CommandHistorySnapshot } from '../../controller/commands/CommandInvoker';
import type { InspectionPayload } from '../../controller/commands/InspectObjectCommand';
import type { GameController } from '../../controller/GameController';
import type { IObserver } from '../../core/interfaces/IObserver';
import type { ThemeType } from '../../core/interfaces/IThemeFactory';
import type { GameStateSnapshot } from '../../core/singletons/GameManager';
import type { Room } from '../../model/entities/Room';
import type { PuzzleSnapshot } from '../../model/puzzles/Puzzle';
import { SequenceStrategy } from '../../model/puzzles/strategies/SequenceStrategy';

export type ModalObservedSnapshot =
  | GameStateSnapshot
  | PuzzleSnapshot
  | CommandHistorySnapshot;

type ActiveModalMode = 'none' | 'reading' | 'switch_panel' | 'pin_keypad' | 'endgame';

/**
 * Vista de modales interactivos en HTML/CSS puro desacoplada de reglas del Modelo.
 */
export class ModalView implements IObserver<ModalObservedSnapshot> {
  private readonly controller: GameController;
  private readonly root: HTMLElement;
  private readonly dialogEl: HTMLElement;

  private mode: ActiveModalMode;
  private pinBuffer: string;
  private observedRoom: Room | null;
  private autoCloseTimerId: number | null;
  private onVisibilityChange?: (isOpen: boolean) => void;

  private switchStatusEl: HTMLElement | null;
  private switchSlotEls: HTMLElement[];
  private switchUndoBtn: HTMLButtonElement | null;
  private pinVisorEl: HTMLElement | null;
  private pinStatusEl: HTMLElement | null;

  constructor(
    container: HTMLElement,
    controller: GameController,
    onVisibilityChange?: (isOpen: boolean) => void
  ) {
    this.controller = controller;
    this.onVisibilityChange = onVisibilityChange;
    this.mode = 'none';
    this.pinBuffer = '';
    this.observedRoom = null;
    this.autoCloseTimerId = null;
    this.switchStatusEl = null;
    this.switchSlotEls = [];
    this.switchUndoBtn = null;
    this.pinVisorEl = null;
    this.pinStatusEl = null;

    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');

    this.dialogEl = document.createElement('div');
    this.dialogEl.className = 'modal-dialog';
    this.root.appendChild(this.dialogEl);

    this.root.addEventListener('click', (event) => {
      if (
        event.target === this.root &&
        this.mode !== 'endgame'
      ) {
        this.close(true);
      }
    });

    container.appendChild(this.root);
  }

  /**
   * Suscribe `ModalView` a los `Puzzle` de la sala activa para refrescar modales en vivo.
   */
  public bindRoomPuzzles(room: Room | null): void {
    if (this.observedRoom) {
      for (const puzzle of this.observedRoom.getAllPuzzles()) {
        puzzle.detach(this);
      }
    }
    this.observedRoom = room;
    if (room) {
      for (const puzzle of room.getAllPuzzles()) {
        puzzle.attach(this);
      }
    }
  }

  public isOpen(): boolean {
    return this.mode !== 'none';
  }

  public getMode(): ActiveModalMode {
    return this.mode;
  }

  /**
   * Abre el modal apropiado a partir de un `InspectionPayload` emitido por `InspectObjectCommand`.
   */
  public openFromInspection(payload: InspectionPayload): void {
    this.clearAutoCloseTimer();

    const theme = this.getActiveTheme();
    this.applyThemeClass(theme);
    this.controller.getSceneManager().getCameraController().unlock();

    if (payload.responseKind === 'open_switch_panel') {
      this.openSwitchPanelModal(payload.title);
      return;
    }

    if (payload.responseKind === 'open_pin_keypad') {
      this.openPinKeypadModal(payload.title);
      return;
    }

    this.openReadingModal(payload);
  }

  /**
   * Cierra el modal activo y opcionalmente reanuda Pointer Lock si la partida sigue activa.
   */
  public close(resumePointerLock = true): void {
    this.clearAutoCloseTimer();
    if (this.mode === 'none') {
      return;
    }

    this.mode = 'none';
    this.pinBuffer = '';
    this.switchStatusEl = null;
    this.switchSlotEls = [];
    this.switchUndoBtn = null;
    this.pinVisorEl = null;
    this.pinStatusEl = null;

    this.root.classList.add('hidden');
    this.dialogEl.innerHTML = '';
    this.dialogEl.className = 'modal-dialog';
    this.onVisibilityChange?.(false);

    if (
      resumePointerLock &&
      this.controller.getGameManager().getLifecycleState() === 'playing'
    ) {
      this.controller.getSceneManager().getCameraController().lock();
    }
  }

  /**
   * Procesa entradas de teclado físico mientras haya un modal interactivo abierto.
   */
  public handleKeyDown(event: KeyboardEvent): boolean {
    if (this.mode === 'none') {
      return false;
    }

    if (event.code === 'Escape' && this.mode !== 'endgame') {
      event.preventDefault();
      this.close(true);
      return true;
    }

    if (this.mode === 'reading' && (event.code === 'KeyE' || event.code === 'Enter')) {
      event.preventDefault();
      this.close(true);
      return true;
    }

    if (this.mode === 'switch_panel') {
      if (event.key === '1' || event.code === 'KeyA') {
        event.preventDefault();
        this.controller.submitSwitch('A');
        return true;
      }
      if (event.key === '2' || event.code === 'KeyB') {
        event.preventDefault();
        this.controller.submitSwitch('B');
        return true;
      }
      if (event.key === '3' || event.code === 'KeyC') {
        event.preventDefault();
        this.controller.submitSwitch('C');
        return true;
      }
      if (event.code === 'KeyZ') {
        event.preventDefault();
        this.controller.undoLastAction();
        return true;
      }
      return true;
    }

    if (this.mode === 'pin_keypad') {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        this.appendPinDigit(event.key);
        return true;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        this.backspacePinDigit();
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmPinCode();
        return true;
      }
      return true;
    }

    return this.mode === 'endgame';
  }

  public update(snapshot: ModalObservedSnapshot): void {
    if ('lifecycleState' in snapshot) {
      if (snapshot.lifecycleState === 'won' || snapshot.lifecycleState === 'lost') {
        this.openEndgameModal(snapshot);
      } else if (snapshot.lifecycleState === 'menu' || snapshot.lifecycleState === 'playing') {
        if (this.mode === 'endgame' || snapshot.lifecycleState === 'menu') {
          this.close(false);
        }
      }
      return;
    }

    if ('puzzleId' in snapshot) {
      if (snapshot.puzzleId === 'sequence_puzzle' && this.mode === 'switch_panel') {
        this.refreshSwitchPanelModal(snapshot);
      } else if (snapshot.puzzleId === 'pin_puzzle' && this.mode === 'pin_keypad') {
        this.refreshPinKeypadFeedback(snapshot);
      }
      return;
    }

    if ('entries' in snapshot && this.mode === 'switch_panel') {
      this.refreshSwitchUndoButton();
    }
  }

  public dispose(): void {
    this.clearAutoCloseTimer();
    this.bindRoomPuzzles(null);
    this.root.remove();
  }

  private openReadingModal(payload: InspectionPayload): void {
    const theme = this.getActiveTheme();
    this.mode = 'reading';
    this.dialogEl.className = `modal-dialog modal-reading modal-theme--${theme}`;

    const bodyText = payload.noteContent ?? payload.message;
    const subtitle =
      payload.kind === 'note'
        ? theme === 'horror'
          ? 'Documento Manuscrito'
          : 'Datapad de Ingeniería'
        : payload.kind === 'desk_box'
          ? payload.isLocked
            ? 'Cerradura Asegurada'
            : 'Nota Recuperada del Cofre'
          : payload.kind === 'wall_marking'
            ? 'Inscripción del Muro Sur'
            : 'Inspección';

    this.dialogEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'modal-header';

    const kicker = document.createElement('span');
    kicker.className = 'modal-kicker';
    kicker.textContent = subtitle;

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = payload.title;

    header.append(kicker, title);

    const contentBox = document.createElement('pre');
    contentBox.className = 'reading-content';
    contentBox.textContent = bodyText;

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-primary-btn';
    closeBtn.textContent = 'Cerrar (ESC / E)';
    closeBtn.addEventListener('click', () => this.close(true));

    footer.appendChild(closeBtn);
    this.dialogEl.append(header, contentBox, footer);

    this.showRoot();
  }

  private openSwitchPanelModal(titleText: string): void {
    const theme = this.getActiveTheme();
    this.mode = 'switch_panel';
    this.dialogEl.className = `modal-dialog modal-switch modal-theme--${theme}`;
    this.dialogEl.innerHTML = `
      <div class="modal-header">
        <span class="modal-kicker">Secuencia de 5 Movimientos</span>
        <h2 class="modal-title">${this.escapeHtml(titleText)}</h2>
      </div>
      <div class="sequence-slots-row" data-role="slots">
        <div class="sequence-slot" data-slot="0">1</div>
        <div class="sequence-slot" data-slot="1">2</div>
        <div class="sequence-slot" data-slot="2">3</div>
        <div class="sequence-slot" data-slot="3">4</div>
        <div class="sequence-slot" data-slot="4">5</div>
      </div>
      <p class="modal-status-msg" data-role="status">
        Acciona las 5 palancas en el orden reconstruido con las 3 pistas.
      </p>
      <div class="switch-buttons-grid">
        <button type="button" class="switch-lever-btn" data-symbol="A">
          <span class="lever-letter">A</span>
          <span class="lever-hint">Tecla 1 / A</span>
        </button>
        <button type="button" class="switch-lever-btn" data-symbol="B">
          <span class="lever-letter">B</span>
          <span class="lever-hint">Tecla 2 / B</span>
        </button>
        <button type="button" class="switch-lever-btn" data-symbol="C">
          <span class="lever-letter">C</span>
          <span class="lever-hint">Tecla 3 / C</span>
        </button>
      </div>
      <div class="modal-footer modal-footer--split">
        <button type="button" class="modal-secondary-btn" data-action="undo">
          Deshacer paso (Z)
        </button>
        <button type="button" class="modal-primary-btn" data-action="close">
          Cerrar (ESC)
        </button>
      </div>
    `;

    this.switchStatusEl = this.dialogEl.querySelector<HTMLElement>('[data-role="status"]');
    this.switchSlotEls = Array.from(
      this.dialogEl.querySelectorAll<HTMLElement>('.sequence-slot')
    );
    this.switchUndoBtn = this.dialogEl.querySelector<HTMLButtonElement>('[data-action="undo"]');

    const leverButtons = this.dialogEl.querySelectorAll<HTMLButtonElement>('[data-symbol]');
    for (const btn of leverButtons) {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.symbol;
        if (symbol) {
          this.controller.submitSwitch(symbol);
        }
      });
    }

    this.switchUndoBtn?.addEventListener('click', () => {
      this.controller.undoLastAction();
    });

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.addEventListener('click', () => this.close(true));

    this.syncSwitchSlotsFromModel();
    this.refreshSwitchUndoButton();
    this.showRoot();
  }

  private refreshSwitchPanelModal(snapshot: PuzzleSnapshot): void {
    this.syncSwitchSlotsFromModel();
    this.refreshSwitchUndoButton();

    if (this.switchStatusEl) {
      this.switchStatusEl.textContent = snapshot.lastMessage || 'Secuencia actualizada.';
      this.switchStatusEl.classList.remove('error', 'success');
      if (snapshot.eventType === 'attempt_failed') {
        this.switchStatusEl.classList.add('error');
        this.triggerDialogPulse('shake-error');
      } else if (snapshot.isSolved) {
        this.switchStatusEl.classList.add('success');
        this.triggerDialogPulse('flash-success');
        this.autoCloseTimerId = window.setTimeout(() => {
          this.close(true);
        }, 950);
      }
    }
  }

  private syncSwitchSlotsFromModel(): void {
    const puzzle = this.controller.getGameManager().getCurrentRoom()?.getPuzzle('sequence_puzzle');
    const strategy = puzzle?.getStrategy();
    const isSolved = Boolean(puzzle?.getIsSolved());

    let steps: readonly string[] = [];
    if (strategy instanceof SequenceStrategy) {
      steps = isSolved
        ? strategy.getExpectedSequence()
        : strategy.getCurrentSequence();
    }

    this.switchSlotEls.forEach((slotEl, index) => {
      const value = steps[index];
      slotEl.textContent = value ?? String(index + 1);
      slotEl.classList.toggle('filled', Boolean(value) && !isSolved);
      slotEl.classList.toggle('solved', isSolved);
    });
  }

  private refreshSwitchUndoButton(): void {
    if (!this.switchUndoBtn) {
      return;
    }
    const entries = this.controller.getCommandInvoker().getHistory();
    const lastReversible = [...entries]
      .reverse()
      .find((entry) => entry.reversible && !entry.undone);
    this.switchUndoBtn.disabled =
      !lastReversible || lastReversible.commandName !== 'ToggleSwitchCommand';
  }

  private openPinKeypadModal(titleText: string): void {
    const theme = this.getActiveTheme();
    this.mode = 'pin_keypad';
    this.pinBuffer = '';
    this.dialogEl.className = `modal-dialog modal-keypad modal-theme--${theme}`;
    this.dialogEl.innerHTML = `
      <div class="modal-header">
        <span class="modal-kicker">Cerradura Electrónica de 4 Dígitos</span>
        <h2 class="modal-title">${this.escapeHtml(titleText)}</h2>
      </div>
      <div class="pin-visor" data-role="visor">_ _ _ _</div>
      <p class="modal-status-msg" data-role="status">
        Usa el teclado en pantalla o las teclas 0–9 + Enter.
      </p>
      <div class="keypad-grid">
        <button type="button" class="keypad-key" data-digit="1">1</button>
        <button type="button" class="keypad-key" data-digit="2">2</button>
        <button type="button" class="keypad-key" data-digit="3">3</button>
        <button type="button" class="keypad-key" data-digit="4">4</button>
        <button type="button" class="keypad-key" data-digit="5">5</button>
        <button type="button" class="keypad-key" data-digit="6">6</button>
        <button type="button" class="keypad-key" data-digit="7">7</button>
        <button type="button" class="keypad-key" data-digit="8">8</button>
        <button type="button" class="keypad-key" data-digit="9">9</button>
        <button type="button" class="keypad-key keypad-key--action" data-action="clear">Borrar</button>
        <button type="button" class="keypad-key" data-digit="0">0</button>
        <button type="button" class="keypad-key keypad-key--confirm" data-action="confirm">Confirmar</button>
      </div>
      <div class="modal-footer">
        <button type="button" class="modal-secondary-btn" data-action="close">
          Cerrar (ESC)
        </button>
      </div>
    `;

    this.pinVisorEl = this.dialogEl.querySelector<HTMLElement>('[data-role="visor"]');
    this.pinStatusEl = this.dialogEl.querySelector<HTMLElement>('[data-role="status"]');

    const digitBtns = this.dialogEl.querySelectorAll<HTMLButtonElement>('[data-digit]');
    for (const btn of digitBtns) {
      btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        if (digit) {
          this.appendPinDigit(digit);
        }
      });
    }

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="clear"]')
      ?.addEventListener('click', () => this.backspacePinDigit());

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="confirm"]')
      ?.addEventListener('click', () => this.confirmPinCode());

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.addEventListener('click', () => this.close(true));

    this.renderPinVisor();
    this.showRoot();
  }

  private appendPinDigit(digit: string): void {
    if (this.pinBuffer.length >= 4) {
      return;
    }
    this.controller.getGameManager().getAudioManager().playPinKey();
    this.pinBuffer += digit;
    this.renderPinVisor();
  }

  private backspacePinDigit(): void {
    if (this.pinBuffer.length === 0) {
      return;
    }
    this.controller.getGameManager().getAudioManager().playClick();
    this.pinBuffer = this.pinBuffer.slice(0, -1);
    this.renderPinVisor();
  }

  private confirmPinCode(): void {
    if (this.pinBuffer.length < 4) {
      if (this.pinStatusEl) {
        this.pinStatusEl.textContent = 'Ingresa los 4 dígitos antes de confirmar.';
        this.pinStatusEl.classList.add('error');
      }
      this.triggerDialogPulse('shake-error');
      return;
    }

    const code = this.pinBuffer;
    this.pinBuffer = '';
    this.renderPinVisor();
    this.controller.submitPinCode(code);
  }

  private renderPinVisor(): void {
    if (!this.pinVisorEl) {
      return;
    }
    const chars = [0, 1, 2, 3].map((i) => this.pinBuffer[i] ?? '_');
    this.pinVisorEl.textContent = chars.join(' ');
  }

  private refreshPinKeypadFeedback(snapshot: PuzzleSnapshot): void {
    if (this.pinStatusEl) {
      this.pinStatusEl.textContent = snapshot.lastMessage;
      this.pinStatusEl.classList.remove('error', 'success');
    }

    if (snapshot.isSolved) {
      this.pinStatusEl?.classList.add('success');
      if (this.pinVisorEl) {
        this.pinVisorEl.textContent = 'OPEN';
      }
      this.triggerDialogPulse('flash-success');
      this.autoCloseTimerId = window.setTimeout(() => {
        this.close(true);
      }, 850);
    } else if (snapshot.eventType === 'attempt_failed') {
      this.pinStatusEl?.classList.add('error');
      this.triggerDialogPulse('shake-error');
    }
  }

  private openEndgameModal(snapshot: GameStateSnapshot): void {
    this.clearAutoCloseTimer();
    const theme = snapshot.themeType ?? this.getActiveTheme();
    this.applyThemeClass(theme);
    this.controller.getSceneManager().getCameraController().unlock();

    this.mode = 'endgame';
    const isWin = snapshot.lifecycleState === 'won';
    const themeName =
      theme === 'scifi' ? 'Nave Sci-Fi (Aether-9)' : 'Mansión de Terror (Blackwood)';
    const commandCount = this.controller.getCommandInvoker().getHistory().length;

    this.dialogEl.className = `modal-dialog modal-endgame modal-theme--${theme} ${isWin ? 'won' : 'lost'}`;
    this.dialogEl.innerHTML = `
      <div class="modal-header">
        <span class="modal-kicker">${isWin ? 'Misión Completada' : 'Tiempo Agotado'}</span>
        <h2 class="modal-title">${isWin ? '¡Escapaste a Tiempo!' : 'La Sala Se Selló'}</h2>
      </div>
      <p class="endgame-narrative">${this.escapeHtml(snapshot.statusMessage)}</p>
      <div class="endgame-stats-grid">
        <div class="stat-box">
          <span class="stat-label">Temática</span>
          <strong class="stat-value">${this.escapeHtml(themeName)}</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">Tiempo Restante</span>
          <strong class="stat-value">${this.escapeHtml(snapshot.remainingFormattedTime)}</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">Acertijos</span>
          <strong class="stat-value">${snapshot.solvedCount} / ${snapshot.totalPuzzles}</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">Comandos Ejecutados</span>
          <strong class="stat-value">${commandCount}</strong>
        </div>
      </div>
      <div class="modal-footer modal-footer--split">
        <button type="button" class="modal-primary-btn" data-action="restart">
          Reiniciar Sala (Prototype)
        </button>
        <button type="button" class="modal-secondary-btn" data-action="menu">
          Volver al Menú / Cambiar Temática
        </button>
      </div>
    `;

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="restart"]')
      ?.addEventListener('click', () => {
        this.close(false);
        this.controller.restartCurrentGame();
      });

    this.dialogEl
      .querySelector<HTMLButtonElement>('[data-action="menu"]')
      ?.addEventListener('click', () => {
        this.close(false);
        this.controller.returnToMainMenu();
      });

    this.showRoot();
  }

  private showRoot(): void {
    this.root.classList.remove('hidden');
    this.onVisibilityChange?.(true);
  }

  private triggerDialogPulse(className: 'shake-error' | 'flash-success'): void {
    this.dialogEl.classList.remove('shake-error', 'flash-success');
    void this.dialogEl.offsetWidth;
    this.dialogEl.classList.add(className);
  }

  private clearAutoCloseTimer(): void {
    if (this.autoCloseTimerId !== null) {
      window.clearTimeout(this.autoCloseTimerId);
      this.autoCloseTimerId = null;
    }
  }

  private getActiveTheme(): ThemeType {
    return (
      this.controller.getGameManager().getCurrentRoom()?.themeConfiguration.themeType ??
      'horror'
    );
  }

  private applyThemeClass(theme: ThemeType): void {
    this.root.dataset.theme = theme;
  }

  private escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
