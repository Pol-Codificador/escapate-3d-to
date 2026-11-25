import './style.css';
import { GameController, type HoverTargetInfo } from './controller/GameController';
import type { ThemeType } from './core/interfaces/IThemeFactory';
import type { GameStateSnapshot } from './core/singletons/GameManager';
import { SceneManager } from './view/scene/SceneManager';

const sceneContainer = document.querySelector<HTMLDivElement>('#scene-container');
const themeToggleBtn = document.querySelector<HTMLButtonElement>('#theme-toggle-btn');
const pointerLockBanner = document.querySelector<HTMLDivElement>('#pointer-lock-banner');
const crosshairEl = document.querySelector<HTMLDivElement>('#crosshair');
const interactionPromptEl = document.querySelector<HTMLDivElement>('#interaction-prompt');
const statusLineEl = document.querySelector<HTMLDivElement>('#status-line');

if (
  !sceneContainer ||
  !themeToggleBtn ||
  !pointerLockBanner ||
  !crosshairEl ||
  !interactionPromptEl ||
  !statusLineEl
) {
  throw new Error('No se encontraron los elementos base del DOM para inicializar la Fase 2.');
}

const sceneManager = new SceneManager(sceneContainer);
const controller = new GameController(sceneManager);
const cameraController = sceneManager.getCameraController();
const gameManager = controller.getGameManager();

let currentTheme: ThemeType = 'horror';
let currentHover: HoverTargetInfo | null = null;
let pinInputBuffer = '';

function updateThemeButtonLabel(): void {
  themeToggleBtn!.textContent =
    currentTheme === 'horror'
      ? 'Cambiar a Nave Sci-Fi'
      : 'Cambiar a Mansión de Terror';
}

function updateStatusLine(message: string): void {
  const state = gameManager.getSnapshot();
  statusLineEl!.textContent = `[${state.remainingFormattedTime}] (${state.solvedCount}/${state.totalPuzzles}) ${message}`;
}

function renderHoverPrompt(hover: HoverTargetInfo | null): void {
  currentHover = hover;

  if (!hover) {
    pinInputBuffer = '';
    crosshairEl!.classList.remove('active');
    interactionPromptEl!.classList.add('hidden');
    interactionPromptEl!.textContent = '';
    return;
  }

  crosshairEl!.classList.add('active');
  interactionPromptEl!.classList.remove('hidden');

  if (hover.object.kind === 'switch_panel' && hover.switchSymbol) {
    const seqSolved = Boolean(
      gameManager.getCurrentRoom()?.getPuzzle('sequence_puzzle')?.getIsSolved()
    );
    interactionPromptEl!.textContent = seqSolved
      ? hover.object.interactionPrompt
      : `[E / Click] Accionar interruptor ${hover.switchSymbol} (o teclas 1=A, 2=B, 3=C)`;
    return;
  }

  if (hover.object.kind === 'safe' && hover.object.isLocked) {
    const bufferDisplay = pinInputBuffer.padEnd(4, '_');
    interactionPromptEl!.textContent = `${hover.object.interactionPrompt} — Teclado 0-9: [${bufferDisplay}]`;
    return;
  }

  interactionPromptEl!.textContent = hover.object.interactionPrompt;
}

controller.setHoverListener((hover) => {
  renderHoverPrompt(hover);
});

controller.setInspectionListener((payload) => {
  if (payload.noteContent) {
    const singleLine = payload.noteContent.replace(/\s+/g, ' ').trim();
    updateStatusLine(`${payload.title}: ${singleLine}`);
    return;
  }
  updateStatusLine(`${payload.title}: ${payload.message}`);
});

gameManager.attach({
  update: (snapshot: GameStateSnapshot): void => {
    updateStatusLine(snapshot.statusMessage);
  },
});

controller.getCommandInvoker().attach({
  update: (historySnapshot): void => {
    if (historySnapshot.eventType === 'undone') {
      updateStatusLine(historySnapshot.statusMessage);
    }
  },
});

cameraController.onLockChange((locked) => {
  pointerLockBanner.classList.toggle('hidden', locked);
});

sceneManager.getDomElement().addEventListener('click', () => {
  if (!cameraController.isLocked()) {
    gameManager.getAudioManager().unlockAudio();
    cameraController.lock();
    return;
  }

  if (currentHover) {
    controller.handleObjectInteraction(
      currentHover.object.id,
      currentHover.switchSymbol
    );
    renderHoverPrompt(currentHover);
  }
});

themeToggleBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  pinInputBuffer = '';
  currentTheme = currentTheme === 'horror' ? 'scifi' : 'horror';
  updateThemeButtonLabel();
  controller.startNewGame(currentTheme);
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE' && currentHover) {
    controller.handleObjectInteraction(
      currentHover.object.id,
      currentHover.switchSymbol
    );
    renderHoverPrompt(currentHover);
    return;
  }

  if (event.code === 'KeyZ') {
    const undone = controller.undoLastAction();
    if (!undone) {
      updateStatusLine('No hay acciones reversibles recientes para deshacer.');
    }
    return;
  }

  if (event.code === 'KeyR') {
    pinInputBuffer = '';
    controller.restartCurrentGame();
    return;
  }

  if (currentHover?.object.kind === 'switch_panel') {
    if (event.key === '1') controller.submitSwitch('A');
    if (event.key === '2') controller.submitSwitch('B');
    if (event.key === '3') controller.submitSwitch('C');
    return;
  }

  if (currentHover?.object.kind === 'safe' && currentHover.object.isLocked) {
    if (/^\d$/.test(event.key)) {
      pinInputBuffer += event.key;
      if (pinInputBuffer.length >= 4) {
        const pin = pinInputBuffer.slice(0, 4);
        pinInputBuffer = '';
        controller.submitPinCode(pin);
      }
      renderHoverPrompt(currentHover);
    } else if (event.key === 'Backspace' && pinInputBuffer.length > 0) {
      pinInputBuffer = pinInputBuffer.slice(0, -1);
      renderHoverPrompt(currentHover);
    }
  }
});

updateThemeButtonLabel();
controller.startNewGame(currentTheme);
controller.startLoop();
