import './style.css';
import { GameManager } from './core/singletons/GameManager';
import type { ThemeType } from './core/interfaces/IThemeFactory';

interface ThemeSmokeReport {
  readonly theme: ThemeType;
  readonly roomTitle: string;
  readonly observerNotifications: number;
  readonly undoStepWorked: boolean;
  readonly clueRevealed: boolean;
  readonly itemPickedUp: string;
  readonly exitOpenedByObserver: boolean;
  readonly finalLifecycleOnEscape: string;
  readonly criticalTimerTriggered: boolean;
  readonly criticalFormattedTime: string;
  readonly restartClonedCleanRoom: boolean;
  readonly audioPlayedCount: number;
}

function runThemeSmokeTest(theme: ThemeType): ThemeSmokeReport {
  const gameManager = GameManager.getInstance();
  const audioManager = gameManager.getAudioManager();
  const inventory = gameManager.getInventory();
  const timer = gameManager.getTimer();

  let observerNotifications = 0;
  const unsubscribeSpy = {
    update: (): void => {
      observerNotifications += 1;
    },
  };
  gameManager.attach(unsubscribeSpy);

  const room = gameManager.startGame(theme);
  const prototype = gameManager.getRoomPrototype();
  if (!prototype || room === prototype) {
    throw new Error(`Se esperaba una instancia clonada distinta al prototipo para ${theme}.`);
  }

  const seqPuzzle = room.getPuzzle('sequence_puzzle');
  const pinPuzzle = room.getPuzzle('pin_puzzle');
  const exitPuzzle = room.getPuzzle('exit_puzzle');
  const clueWall = room.getObject('clue_wall');
  const rewardPickup = room.getObject('reward_item_pickup');

  if (!seqPuzzle || !pinPuzzle || !exitPuzzle || !clueWall || !rewardPickup) {
    throw new Error(`Faltan acertijos u objetos requeridos en la sala ${theme}.`);
  }

  // 1) Verificar SequenceStrategy + popStep() (undoLastStep) + resolución
  const firstStep = theme === 'horror' ? 'B' : 'C';
  const secondStep = theme === 'horror' ? 'A' : 'B';
  const thirdStep = theme === 'horror' ? 'C' : 'A';

  seqPuzzle.attempt(firstStep);
  seqPuzzle.attempt('WRONG');
  const undoStepWorked = seqPuzzle.undoLastStep();
  if (!undoStepWorked) {
    throw new Error(`undoLastStep() falló en ${theme}.`);
  }
  seqPuzzle.attempt(secondStep);
  const seqSolved = seqPuzzle.attempt(thirdStep);

  if (!seqSolved.isValid || !seqPuzzle.getIsSolved()) {
    throw new Error(`Acertijo de secuencia no se resolvió en ${theme}.`);
  }

  const clueRevealed = clueWall.isActivated && !clueWall.isLocked;
  if (!clueRevealed) {
    throw new Error(`La pared/proyector de pista no se activó al resolver secuencia en ${theme}.`);
  }

  // 2) Verificar PinCodeStrategy (fallo + código correcto por temática)
  const wrongPin = pinPuzzle.attempt('0000');
  if (wrongPin.isValid) {
    throw new Error(`PIN inválido fue aceptado en ${theme}.`);
  }

  const expectedPin = theme === 'horror' ? '4829' : '7391';
  const pinSolved = pinPuzzle.attempt(expectedPin);
  if (!pinSolved.isValid || !rewardPickup.isVisible || rewardPickup.isLocked) {
    throw new Error(`La recompensa no se reveló tras resolver el PIN en ${theme}.`);
  }

  // 3) Recoger ítem en Inventory (Observer -> AudioManager)
  const pickedItem = rewardPickup.consumeRewardItem();
  if (!pickedItem || !inventory.addItem(pickedItem)) {
    throw new Error(`No se pudo recoger el ítem de recompensa en ${theme}.`);
  }

  // 4) Resolver acertijo final con el ítem -> ExitDoor (Observer) + GameManager ('won')
  const selectedItem = inventory.getSelectedItem();
  if (!selectedItem) {
    throw new Error(`No hay ítem seleccionado en inventario para ${theme}.`);
  }

  const exitSolved = exitPuzzle.attempt(selectedItem.id);
  const exitOpenedByObserver =
    exitSolved.isValid && !room.exitDoor.isLocked && room.exitDoor.getIsOpen();
  const finalLifecycleOnEscape = gameManager.getLifecycleState();

  if (!exitOpenedByObserver || finalLifecycleOnEscape !== 'won') {
    throw new Error(`ExitDoor o GameManager no reaccionaron al escape en ${theme}.`);
  }

  // 5) Verificar GameTimer crítico (<= 60s) en una partida reiniciada
  const restartedRoom = gameManager.restartGame();
  gameManager.update(245); // 300 - 245 = 55s -> estado crítico <= 60s
  const criticalTimerTriggered = timer.isCritical() && !timer.isExpired();
  const criticalFormattedTime = timer.getFormattedTime();

  // 6) Verificar que restartGame() entrega una sala limpia clonada del prototipo
  const restartedFromZero = gameManager.restartGame();
  const restartClonedCleanRoom =
    restartedFromZero !== room &&
    restartedFromZero !== restartedRoom &&
    restartedFromZero !== prototype &&
    !restartedFromZero.getPuzzle('sequence_puzzle')?.getIsSolved() &&
    !restartedFromZero.getPuzzle('pin_puzzle')?.getIsSolved() &&
    !restartedFromZero.getPuzzle('exit_puzzle')?.getIsSolved() &&
    restartedFromZero.exitDoor.isLocked &&
    !restartedFromZero.exitDoor.getIsOpen() &&
    inventory.getItems().length === 0 &&
    !prototype.getPuzzle('sequence_puzzle')?.getIsSolved();

  if (!restartClonedCleanRoom) {
    throw new Error(`restartGame() no restauró una sala limpia vía Prototype.clone() en ${theme}.`);
  }

  gameManager.detach(unsubscribeSpy);
  gameManager.returnToMenu();

  return {
    theme,
    roomTitle: room.themeConfiguration.narrativeConfig.roomTitle,
    observerNotifications,
    undoStepWorked,
    clueRevealed,
    itemPickedUp: `${pickedItem.name} (${pickedItem.id})`,
    exitOpenedByObserver,
    finalLifecycleOnEscape,
    criticalTimerTriggered,
    criticalFormattedTime,
    restartClonedCleanRoom,
    audioPlayedCount: audioManager.getPlayedSoundsCount(),
  };
}

function runPhase1SmokeSuite(): ThemeSmokeReport[] {
  console.group('ESCAPA TO — Smoke Test Fase 1 (Modelo Puro + Patrones GoF)');
  const reports = [runThemeSmokeTest('horror'), runThemeSmokeTest('scifi')];
  console.table(reports);
  console.info('Fase 1 verificada con éxito para ambas temáticas.');
  console.groupEnd();
  return reports;
}

const reports = runPhase1SmokeSuite();
const appRoot = document.querySelector<HTMLDivElement>('#app');

if (appRoot) {
  const rowsHtml = reports
    .map(
      (report) => `
      <tr>
        <td><strong>${report.theme.toUpperCase()}</strong><br><small>${report.roomTitle}</small></td>
        <td>${report.undoStepWorked ? 'OK' : 'FAIL'}</td>
        <td>${report.clueRevealed ? 'OK' : 'FAIL'}</td>
        <td>${report.itemPickedUp}</td>
        <td>${report.exitOpenedByObserver ? 'Abierta' : 'Cerrada'} (${report.finalLifecycleOnEscape})</td>
        <td>${report.criticalTimerTriggered ? 'Critico' : 'Normal'} (${report.criticalFormattedTime})</td>
        <td>${report.restartClonedCleanRoom ? 'OK' : 'FAIL'}</td>
        <td>${report.observerNotifications} eventos</td>
      </tr>
    `
    )
    .join('');

  appRoot.innerHTML = `
    <main class="phase1-status">
      <h1>Escápate!! — Fase 1 Verificada (Modelo Puro + Patrones GoF)</h1>
      <p>
        Smoke test automático ejecutado sobre <code>HorrorThemeFactory</code> y
        <code>SciFiThemeFactory</code> (Strategy, Observer, Abstract Factory, Builder, Prototype y Singleton).
      </p>
      <table class="smoke-table">
        <thead>
          <tr>
            <th>Temática / Sala</th>
            <th>Undo Secuencia</th>
            <th>Pista Revelada</th>
            <th>Ítem Recompensa</th>
            <th>Salida (Observer)</th>
            <th>Timer Crítico (&le; 60s)</th>
            <th>Reinicio Prototype</th>
            <th>Notificaciones</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <p class="smoke-hint">Revisa también la consola del navegador para ver el detalle completo.</p>
    </main>
  `;
}
