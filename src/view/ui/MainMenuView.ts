/**
 * @pattern MVC (Vista HTML/CSS) + Observer (GoF Comportamental)
 * @role View & ConcreteObserver
 *
 * Problema de diseño que resuelve:
 * Presenta la pantalla de bienvenida académica, permite seleccionar la temática
 * (`horror` o `scifi`), muestra los controles FPS y observa el ciclo de vida en
 * `GameManager` (`'menu'` vs `'playing'`) sin acoplarse a la lógica del Modelo.
 */

import type { IObserver } from '../../core/interfaces/IObserver';
import type { ThemeType } from '../../core/interfaces/IThemeFactory';
import type { GameStateSnapshot } from '../../core/singletons/GameManager';

/**
 * Callbacks emitidos por `MainMenuView` hacia el coordinador/controlador.
 */
export interface MainMenuCallbacks {
  readonly onEnterRoom: (theme: ThemeType) => void;
  readonly onThemePreviewChange?: (theme: ThemeType) => void;
}

/**
 * Vista del Menú Principal en HTML/CSS puro.
 */
export class MainMenuView implements IObserver<GameStateSnapshot> {
  private readonly root: HTMLElement;
  private readonly callbacks: MainMenuCallbacks;
  private readonly horrorCard: HTMLButtonElement;
  private readonly scifiCard: HTMLButtonElement;
  private readonly startButton: HTMLButtonElement;

  private selectedTheme: ThemeType;

  constructor(container: HTMLElement, callbacks: MainMenuCallbacks) {
    this.callbacks = callbacks;
    this.selectedTheme = 'horror';

    this.root = document.createElement('section');
    this.root.className = 'main-menu-overlay';
    this.root.setAttribute('aria-label', 'Menú Principal');

    this.root.innerHTML = `
      <div class="menu-panel">
        <header class="menu-header">
          <span class="academic-pill">UNSA · EPIS · Tecnología de Objetos</span>
          <h1 class="menu-title">Escápate!! — Escape Room 3D</h1>
          <p class="menu-subtitle">
            Explora en primera persona, reúne las 3 pistas encadenadas, resuelve los 4 acertijos
            y escapa antes de que el tiempo llegue a cero.
          </p>
        </header>

        <div class="theme-cards-grid">
          <button type="button" class="theme-card theme-card--horror active" data-theme="horror">
            <div class="theme-card-badge">Temática 01</div>
            <h2 class="theme-card-title">Mansión de Terror</h2>
            <p class="theme-card-room">Estudio Sellado de la Mansión Blackwood</p>
            <p class="theme-card-desc">
              Candelabros ámbar, luz de luna entre barrotes, tinta ultravioleta oculta,
              caja fuerte de hierro y portón doble de roble.
            </p>
          </button>

          <button type="button" class="theme-card theme-card--scifi" data-theme="scifi">
            <div class="theme-card-badge">Temática 02</div>
            <h2 class="theme-card-title">Nave Sci-Fi</h2>
            <p class="theme-card-room">Módulo de Contención — Estación Aether-9</p>
            <p class="theme-card-desc">
              Mamparos de titanio, racks de servidores, proyector holográfico cian,
              terminal criogénica y compuerta presurizada.
            </p>
          </button>
        </div>

        <div class="controls-guide">
          <h3 class="controls-title">Controles en Primera Persona</h3>
          <div class="controls-grid">
            <div class="control-chip"><kbd>W A S D</kbd><span>Moverse</span></div>
            <div class="control-chip"><kbd>Mouse</kbd><span>Mirar</span></div>
            <div class="control-chip"><kbd>E / Click</kbd><span>Interactuar</span></div>
            <div class="control-chip"><kbd>1 – 5</kbd><span>Inventario</span></div>
            <div class="control-chip"><kbd>Z</kbd><span>Deshacer (Command)</span></div>
            <div class="control-chip"><kbd>F</kbd><span>Linterna</span></div>
            <div class="control-chip"><kbd>H</kbd><span>Historial de Comandos</span></div>
            <div class="control-chip"><kbd>R</kbd><span>Reiniciar (Prototype)</span></div>
            <div class="control-chip"><kbd>ESC</kbd><span>Pausa / Cursor</span></div>
          </div>
        </div>

        <footer class="menu-footer">
          <button type="button" class="primary-enter-btn" data-action="enter-room">
            Entrar a la Sala
          </button>
        </footer>
      </div>
    `;

    container.appendChild(this.root);

    const horrorBtn = this.root.querySelector<HTMLButtonElement>('[data-theme="horror"]');
    const scifiBtn = this.root.querySelector<HTMLButtonElement>('[data-theme="scifi"]');
    const enterBtn = this.root.querySelector<HTMLButtonElement>('[data-action="enter-room"]');

    if (!horrorBtn || !scifiBtn || !enterBtn) {
      throw new Error('MainMenuView: faltan elementos interactivos requeridos.');
    }

    this.horrorCard = horrorBtn;
    this.scifiCard = scifiBtn;
    this.startButton = enterBtn;

    this.horrorCard.addEventListener('click', () => {
      this.selectTheme('horror');
    });
    this.scifiCard.addEventListener('click', () => {
      this.selectTheme('scifi');
    });
    this.startButton.addEventListener('click', () => {
      this.callbacks.onEnterRoom(this.selectedTheme);
    });
  }

  public getSelectedTheme(): ThemeType {
    return this.selectedTheme;
  }

  public show(): void {
    this.root.classList.remove('hidden');
  }

  public hide(): void {
    this.root.classList.add('hidden');
  }

  public update(snapshot: GameStateSnapshot): void {
    if (snapshot.lifecycleState === 'menu') {
      this.show();
    } else {
      this.hide();
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private selectTheme(theme: ThemeType): void {
    this.selectedTheme = theme;
    this.horrorCard.classList.toggle('active', theme === 'horror');
    this.scifiCard.classList.toggle('active', theme === 'scifi');
    this.callbacks.onThemePreviewChange?.(theme);
  }
}
