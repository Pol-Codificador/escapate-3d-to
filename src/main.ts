/**
 * @pattern MVC (Arquitectónico)
 * @role Bootstrapper (Fase 2 — Vista Previa Jugable 3D)
 *
 * Problema de diseño que resuelve:
 * Ensambla `SceneManager` (Vista 3D) y `GameController` (Controlador MVC) sobre
 * el DOM mínimo de Fase 2 para probar la exploración FPS, colisiones, raycasting,
 * cambio en vivo entre temáticas y ejecución/reversión de comandos sin adelantar
 * el HUD completo ni los modales de la Fase 3.
 */

import './style.css';
import { GameController } from './controller/GameController';
import type { IObserver } from './core/interfaces/IObserver';
import type { ThemeType } from './core/interfaces/IThemeFactory';
import { AudioManager } from './core/singletons/AudioManager';
import type { GameStateSnapshot } from './core/singletons/GameManager';
import type { InteractiveObject } from './model/entities/InteractiveObject';
import type { TimerSnapshot } from './model/GameTimer';
import { SceneManager } from './view/scene/SceneManager';

const viewportEl = document.querySelector<HTMLDivElement>('#viewport-3d');
const roomTitleEl = document.querySelector<HTMLElement>('#room-title');
const timerReadoutEl = document.querySelector<HTMLElement>('#timer-readout');
const toggleThemeBtn = document.querySelector<HTMLButtonElement>('#btn-toggle-theme');
const pointerBannerEl = document.querySelector<HTMLElement>('#pointer-lock-banner');
const crosshairEl = document.querySelector<HTMLElement>('#crosshair');
const promptEl = document.querySelector<HTMLElement>('#interaction-prompt');
const feedbackEl = document.querySelector<HTMLElement>('#feedback-line');

if (!viewportEl) {
  throw new Error('No se encontró el contenedor #viewport-3d en index.html.');
}

const sceneManager = new SceneManager(viewportEl);
const controller = new GameController(sceneManager);
const gameManager = controller.getGameManager();
const cameraController = sceneManager.getCameraController();

let activeTheme: ThemeType = 'horror';
let hoveredObject: InteractiveObject | null = null;
let pinInputBuffer = '';

function updateThemeButtonLabel(): void {
  if (!toggleThemeBtn) {
    return;
  }
  toggleThemeBtn.textContent =
    activeTheme === 'horror'
      ? 'Cambiar a Nave Sci-Fi'
      : 'Cambiar a Mansión de Terror';
}

function renderHoverPrompt(object: InteractiveObject | null): void {
  if (!promptEl || !crosshairEl) {
    return;
  }

  if (!object) {
    promptEl.classList.add('hidden');
    promptEl.textContent = '';
    crosshairEl.classList.remove('active');
    return;
  }

  crosshairEl.classList.add('active');
  promptEl.classList.remove('hidden');

  if (object.kind === 'switch_panel' && !object.isActivated) {
    promptEl.textContent = `${object.interactionPrompt} (Prueba rápida: teclas 1=A, 2=B, 3=C | Z deshacer)`;
  } else if (object.kind === 'safe' && object.isLocked) {
    const bufferDisplay = pinInputBuffer.padEnd(4, '_');
    promptEl.textContent = `${object.interactionPrompt} (Teclea 4 dígitos: ${bufferDisplay})`;
  } else {
    promptEl.textContent = object.interactionPrompt;
  }
}

const gameObserver: IObserver<GameStateSnapshot> = {
  update: (snapshot: GameStateSnapshot): void => {
    if (roomTitleEl && snapshot.roomTitle) {
      roomTitleEl.textContent = snapshot.roomTitle;
    }
    if (
      feedbackEl &&
      (snapshot.lifecycleState === 'won' || snapshot.lifecycleState === 'lost')
    ) {
      feedbackEl.textContent = snapshot.statusMessage;
    }
  },
};

const timerObserver: IObserver<TimerSnapshot> = {
  update: (snapshot: TimerSnapshot): void => {
    if (!timerReadoutEl) {
      return;
    }
    timerReadoutEl.textContent = snapshot.formattedTime;
    timerReadoutEl.classList.toggle('critical', snapshot.isCritical);
  },
};

gameManager.attach(gameObserver);
gameManager.getTimer().attach(timerObserver);

controller.onHoveredObjectChange((object) => {
  hoveredObject = object;
  if (!object || object.kind !== 'safe') {
    pinInputBuffer = '';
  }
  renderHoverPrompt(object);
});

controller.onFeedbackMessage((message) => {
  if (feedbackEl) {
    feedbackEl.textContent = message;
  }
});

controller.onObjectInspected((payload) => {
  if (feedbackEl && payload.noteContent) {
    feedbackEl.textContent = payload.noteContent.replace(/\n+/g, ' ');
  }
});

cameraController.onLockChange((locked) => {
  pointerBannerEl?.classList.toggle('hidden', locked);
});

sceneManager.getCanvas().addEventListener('click', () => {
  AudioManager.getInstance().unlockAudio();
  if (!cameraController.isLocked()) {
    cameraController.lock();
    return;
  }

  if (hoveredObject) {
    controller.handleObjectInteraction(hoveredObject.id);
    renderHoverPrompt(sceneManager.getHoveredObject());
  }
});

toggleThemeBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  AudioManager.getInstance().unlockAudio();
  activeTheme = activeTheme === 'horror' ? 'scifi' : 'horror';
  pinInputBuffer = '';
  controller.startNewGame(activeTheme);
  updateThemeButtonLabel();
});

window.addEventListener('keydown', (event) => {
  AudioManager.getInstance().unlockAudio();

  if (event.code === 'KeyE' && hoveredObject) {
    controller.handleObjectInteraction(hoveredObject.id);
    renderHoverPrompt(sceneManager.getHoveredObject());
    return;
  }

  if (event.code === 'KeyZ') {
    controller.undoLastAction();
    renderHoverPrompt(sceneManager.getHoveredObject());
    return;
  }

  if (event.code === 'KeyR') {
    pinInputBuffer = '';
    controller.restartCurrentGame();
    renderHoverPrompt(sceneManager.getHoveredObject());
    return;
  }

  // Atajos temporales de Fase 2 para probar interruptores y teclado numérico en 3D
  if (hoveredObject?.kind === 'switch_panel' && !hoveredObject.isActivated) {
    if (event.key === '1') {
      controller.submitSwitch('A');
      return;
    }
    if (event.key === '2') {
      controller.submitSwitch('B');
      return;
    }
    if (event.key === '3') {
      controller.submitSwitch('C');
      return;
    }
  }

  if (hoveredObject?.kind === 'safe' && hoveredObject.isLocked) {
    if (/^\d$/.test(event.key)) {
      pinInputBuffer += event.key;
      renderHoverPrompt(hoveredObject);
      if (pinInputBuffer.length === 4) {
        controller.submitPinCode(pinInputBuffer);
        pinInputBuffer = '';
        renderHoverPrompt(sceneManager.getHoveredObject());
      }
    } else if (event.code === 'Backspace' && pinInputBuffer.length > 0) {
      pinInputBuffer = pinInputBuffer.slice(0, -1);
      renderHoverPrompt(hoveredObject);
    }
  }
});

controller.startNewGame(activeTheme);
updateThemeButtonLabel();
controller.startLoop();
