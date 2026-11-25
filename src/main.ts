import './style.css';
import { GameController, type HoverTargetInfo } from './controller/GameController';
import type { ThemeType } from './core/interfaces/IThemeFactory';
import { RoomDirector } from './model/builders/RoomDirector';
import type { Room } from './model/entities/Room';
import { HorrorThemeFactory } from './model/factories/HorrorThemeFactory';
import { SciFiThemeFactory } from './model/factories/SciFiThemeFactory';
import { SceneManager } from './view/scene/SceneManager';
import { CommandLogView } from './view/ui/CommandLogView';
import { HudView } from './view/ui/HudView';
import { MainMenuView } from './view/ui/MainMenuView';
import { ModalView } from './view/ui/ModalView';

const sceneContainer = document.querySelector<HTMLDivElement>('#scene-container');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');

if (!sceneContainer || !uiRoot) {
  throw new Error('No se encontraron #scene-container o #ui-root para iniciar la aplicación.');
}

const sceneManager = new SceneManager(sceneContainer);
const controller = new GameController(sceneManager);
const gameManager = controller.getGameManager();
const cameraController = sceneManager.getCameraController();
const previewDirector = new RoomDirector();

let currentHover: HoverTargetInfo | null = null;
let observedRoomForHud: Room | null = null;

function bindActiveRoomToViews(room: Room | null): void {
  if (observedRoomForHud) {
    observedRoomForHud.detach(hudView);
  }
  observedRoomForHud = room;
  if (room) {
    room.attach(hudView);
  }
  modalView.bindRoomPuzzles(room);
}

function renderMenuPreviewScene(theme: ThemeType): void {
  if (gameManager.getLifecycleState() !== 'menu') {
    return;
  }
  const factory =
    theme === 'scifi' ? new SciFiThemeFactory() : new HorrorThemeFactory();
  const previewRoom = previewDirector.constructRoom(factory);
  sceneManager.buildRoomScene(previewRoom);
}

const commandLogView = new CommandLogView(
  uiRoot,
  () => {
    controller.undoLastAction();
  },
  (isOpen) => {
    hudView.syncHistoryState(isOpen);
    if (isOpen) {
      cameraController.unlock();
    } else if (
      !modalView.isOpen() &&
      gameManager.getLifecycleState() === 'playing'
    ) {
      cameraController.lock();
    }
  }
);

const modalView = new ModalView(uiRoot, controller, (isOpen) => {
  hudView.setModalOpen(isOpen);
});

const hudView = new HudView(uiRoot, {
  onToggleMute: () => controller.toggleAudioMute(),
  onToggleFlashlight: () => controller.toggleFlashlight(),
  onToggleHistory: () => {
    commandLogView.toggle();
  },
  onUndo: () => {
    if (!controller.undoLastAction()) {
      hudView.showToast('No hay acciones reversibles para deshacer.', 'warning');
    }
  },
  onRestart: () => {
    modalView.close(false);
    commandLogView.setOpen(false);
    const restartedRoom = controller.restartCurrentGame();
    bindActiveRoomToViews(restartedRoom);
    cameraController.lock();
  },
  onReturnMenu: () => {
    modalView.close(false);
    commandLogView.setOpen(false);
    bindActiveRoomToViews(null);
    controller.returnToMainMenu();
    renderMenuPreviewScene(mainMenuView.getSelectedTheme());
  },
  onSelectSlot: (slotIndex) => {
    controller.selectInventorySlot(slotIndex);
  },
});

const mainMenuView = new MainMenuView(uiRoot, {
  onEnterRoom: (theme) => {
    commandLogView.setOpen(false);
    modalView.close(false);
    const room = controller.startNewGame(theme);
    bindActiveRoomToViews(room);
    hudView.syncMuteState(controller.isAudioMuted());
    hudView.syncFlashlightState(controller.isFlashlightOn());
    hudView.showToast(
      `Sala iniciada: ${room.themeConfiguration.narrativeConfig.roomTitle}`,
      'info'
    );
    cameraController.lock();
  },
  onThemePreviewChange: (theme) => {
    renderMenuPreviewScene(theme);
  },
});

// Suscripción Observer desacoplada entre Modelo/Invoker y las 4 Vistas UI
gameManager.attach(mainMenuView);
gameManager.attach(hudView);
gameManager.attach(modalView);
gameManager.getTimer().attach(hudView);
gameManager.getInventory().attach(hudView);

controller.getCommandInvoker().attach(hudView);
controller.getCommandInvoker().attach(modalView);
controller.getCommandInvoker().attach(commandLogView);

controller.setHoverListener((hover) => {
  currentHover = hover;
  const seqSolved = Boolean(
    gameManager.getCurrentRoom()?.getPuzzle('sequence_puzzle')?.getIsSolved()
  );
  hudView.renderHover(hover, seqSolved);
});

controller.setInspectionListener((payload) => {
  modalView.openFromInspection(payload);
});

cameraController.onLockChange((locked) => {
  hudView.setPointerLocked(locked);
});

sceneManager.getDomElement().addEventListener('click', () => {
  if (
    gameManager.getLifecycleState() !== 'playing' ||
    modalView.isOpen() ||
    commandLogView.isOpen()
  ) {
    return;
  }

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
  }
});

window.addEventListener('keydown', (event) => {
  if (modalView.isOpen()) {
    modalView.handleKeyDown(event);
    return;
  }

  if (gameManager.getLifecycleState() !== 'playing') {
    return;
  }

  if (event.code === 'KeyH') {
    event.preventDefault();
    commandLogView.toggle();
    return;
  }

  if (event.code === 'Escape' && commandLogView.isOpen()) {
    event.preventDefault();
    commandLogView.setOpen(false);
    return;
  }

  if (event.code === 'KeyE' && currentHover && !commandLogView.isOpen()) {
    event.preventDefault();
    controller.handleObjectInteraction(
      currentHover.object.id,
      currentHover.switchSymbol
    );
    return;
  }

  if (event.code === 'KeyZ') {
    event.preventDefault();
    if (!controller.undoLastAction()) {
      hudView.showToast('No hay acciones reversibles recientes para deshacer.', 'warning');
    }
    return;
  }

  if (event.code === 'KeyF') {
    event.preventDefault();
    const on = controller.toggleFlashlight();
    hudView.syncFlashlightState(on);
    hudView.showToast(on ? 'Linterna encendida' : 'Linterna apagada', 'info');
    return;
  }

  if (event.code === 'KeyM') {
    event.preventDefault();
    const muted = controller.toggleAudioMute();
    hudView.syncMuteState(muted);
    hudView.showToast(muted ? 'Audio silenciado' : 'Audio activado', 'info');
    return;
  }

  if (event.code === 'KeyR') {
    event.preventDefault();
    commandLogView.setOpen(false);
    const restartedRoom = controller.restartCurrentGame();
    bindActiveRoomToViews(restartedRoom);
    hudView.showToast('Sala reiniciada desde Prototype', 'info');
    cameraController.lock();
    return;
  }

  if (/^Digit[1-5]$/.test(event.code)) {
    const slotIndex = Number(event.code.replace('Digit', '')) - 1;
    controller.selectInventorySlot(slotIndex);
  }
});

// Arranque limpio en Menú Principal con vista previa 3D de fondo
renderMenuPreviewScene('horror');
mainMenuView.show();
controller.startLoop();
