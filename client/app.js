let currentTurn = null;
let gameFinished = false;
let gamePhase = "WAITING";
let selectedShipSize = 4;
let selectedDirection = "horizontal";
let selectedBattleAction = "shot";
let scannerUsesLeft = 1;
let torpedoBombersLeft = 2;
const TURN_SECONDS = 25;
let scannerRevealTimeout = null;
let temporaryScannerCells = [];
let turnTimerInterval = null;
let turnDeadline = null;
let remainingShips = {
  4: 1,
  3: 2,
  2: 3,
  1: 4
};

window.addEventListener("DOMContentLoaded", function () {
  initBoards();
  initPlacementControls();
  initBattleActionControls();
  renderPlacementControls();
  renderBattleActionControls();
  connectToServer();
});

function handleServerMessage(message) {
  console.log("Server message:", message);

  switch (message.type) {
    case "GAME_JOINED":
      handleGameJoined(message);
      break;

    case "PLACING_STARTED":
      handlePlacingStarted(message);
      break;

    case "SHIP_PLACED":
      handleShipPlaced(message);
      break;

    case "SHIP_REMOVED":
      handleShipRemoved(message);
      break;

    case "PLAYER_READY":
      handlePlayerReady(message);
      break;

    case "GAME_STARTED":
      handleGameStarted(message);
      break;

    case "SHOT_RESULT":
      handleShotResult(message);
      break;

    case "SCAN_RESULT":
      handleScanResult(message);
      break;

    case "ENEMY_SCAN_USED":
      handleEnemyScanUsed(message);
      break;

    case "TORPEDO_RESULT":
      handleTorpedoResult(message);
      break;

    case "ENEMY_TORPEDO_USED":
      handleEnemyTorpedoUsed(message);
      break;

    case "ENEMY_SHOT":
      handleEnemyShot(message);
      break;

    case "TURN_CHANGED":
      handleTurnChanged(message);
      break;

    case "GAME_OVER":
      handleGameOver(message);
      break;

    case "ENEMY_DISCONNECTED":
      handleEnemyDisconnected(message);
      break;

    case "ERROR":
      handleError(message);
      break;

    default:
      console.log("Unknown server message:", message);
  }
}

function handleGameJoined(message) {
  playerId = message.playerId;
  gameId = message.gameId;
  gamePhase = "WAITING";

  document.querySelector("#playerLabel").innerText = `Гравець: ${playerId}`;
  document.querySelector("#turnLabel").innerText = "Очікування";
  document.querySelector("#statusLabel").innerText = "Очікування другого гравця...";
  renderPlacementControls();
  renderBattleActionControls();
  updateTurnIndicator();
}

function handlePlacingStarted(message) {
  gamePhase = "PLACING_SHIPS";
  currentTurn = null;
  remainingShips = message.remainingShips || remainingShips;
  selectedShipSize = getFirstAvailableShipSize();

  document.querySelector("#turnLabel").innerText = "Розміщення кораблів";
  stopTurnTimer();
  updateTurnIndicator();
  updatePlacingStatus(message.shipsPlaced, message.shipsRequired);
  renderPlacementControls();
}

function handleShipPlaced(message) {
  const cells = Array.isArray(message.cells) ? message.cells : [];

  for (const cell of cells) {
    updateBoardCell("me", cell.row, cell.col, "ship", false);
  }

  refreshBoard("me");

  remainingShips = message.remainingShips || remainingShips;
  selectedShipSize = getFirstAvailableShipSize();

  updatePlacingStatus(message.shipsPlaced, message.shipsRequired);
  renderPlacementControls();
}

function handleShipRemoved(message) {
  const cells = Array.isArray(message.cells) ? message.cells : [];

  for (const cell of cells) {
    updateBoardCell("me", cell.row, cell.col, "empty", false);
  }

  refreshBoard("me");

  remainingShips = message.remainingShips || remainingShips;
  selectedShipSize = getFirstAvailableShipSize();

  updatePlacingStatus(message.shipsPlaced, message.shipsRequired);
  renderPlacementControls();
}

function handlePlayerReady(message) {
  document.querySelector("#statusLabel").innerText = message.message;
  document.querySelector("#turnLabel").innerText = "Готово";
  renderPlacementControls();
}

function handleGameStarted(message) {
  gamePhase = "PLAYING";
  currentTurn = message.currentTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  document.querySelector("#statusLabel").innerText = "Гра почалась. Стріляйте по правому полю.";
  selectedBattleAction = "shot";
  scannerUsesLeft = Number(message.scannerUsesLeft ?? 1);
  torpedoBombersLeft = Number(message.torpedoBombersLeft ?? 2);

  renderPlacementControls();
  renderBattleActionControls();
  updateTurnLabel();
}

function handleShotResult(message) {
  updateBoardCell("enemy", message.row, message.col, message.result, false);

  markSunkShipCells("enemy", message.sunkCells);
  markSunkZone("enemy", message.zoneCells);
  refreshBoard("enemy");

  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  if (message.result === "hit") {
    document.querySelector("#statusLabel").innerText = "Влучання! Ви ходите ще раз.";
  } else if (message.result === "sunk") {
    document.querySelector("#statusLabel").innerText = "Корабель потоплено! Зона навколо нього позначена.";
  } else {
    document.querySelector("#statusLabel").innerText = "Промах. Тепер хід суперника.";
  }

  renderBattleActionControls();
  updateTurnLabel();
}

function handleEnemyShot(message) {
  updateBoardCell("me", message.row, message.col, message.result, false);

  markSunkShipCells("me", message.sunkCells);
  markSunkZone("me", message.zoneCells);
  refreshBoard("me");

  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  if (message.result === "hit") {
    document.querySelector("#statusLabel").innerText = "Суперник влучив у ваш корабель.";
  } else if (message.result === "sunk") {
    document.querySelector("#statusLabel").innerText = "Суперник потопив ваш корабель. Зона навколо нього позначена.";
  } else {
    document.querySelector("#statusLabel").innerText = "Суперник промахнувся.";
  }

  renderBattleActionControls();
  updateTurnLabel();
}

function handleScanResult(message) {
  scannerUsesLeft = Number(message.scannerUsesLeft ?? scannerUsesLeft);
  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  showTemporaryScannerCells(message.cells || []);

  document.querySelector("#statusLabel").innerText = message.cells && message.cells.length
    ? "Сканер показав кораблі суперника на 3 секунди. Хід переходить супернику."
    : "Сканер не знайшов кораблів у цій зоні. Хід переходить супернику.";

  selectedBattleAction = "shot";
  renderBattleActionControls();
  updateTurnLabel();
}

function handleEnemyScanUsed(message) {
  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;
  document.querySelector("#statusLabel").innerText = "Суперник використав сканер 3×3.";
  renderBattleActionControls();
  updateTurnLabel();
}

function handleTorpedoResult(message) {
  torpedoBombersLeft = Number(message.torpedoBombersLeft ?? torpedoBombersLeft);
  applyTorpedoCells("enemy", message.pathCells || [], message.sunkCells || [], message.zoneCells || []);

  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  if (message.result === "hit") {
    document.querySelector("#statusLabel").innerText = "Торпедоносець зупинився на першому кораблі суперника. Хід переходить супернику.";
  } else if (message.result === "sunk") {
    document.querySelector("#statusLabel").innerText = "Торпедоносець потопив корабель суперника. Хід переходить супернику.";
  } else {
    document.querySelector("#statusLabel").innerText = "Торпедоносець пройшов увесь рядок і не знайшов кораблів. Хід переходить супернику.";
  }

  selectedBattleAction = "shot";
  renderBattleActionControls();
  updateTurnLabel();
}

function handleEnemyTorpedoUsed(message) {
  applyTorpedoCells("me", message.pathCells || [], message.sunkCells || [], message.zoneCells || []);
  currentTurn = message.nextTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  if (message.result === "hit") {
    document.querySelector("#statusLabel").innerText = "Суперник використав торпедоносець і влучив у ваш корабель.";
  } else if (message.result === "sunk") {
    document.querySelector("#statusLabel").innerText = "Суперник використав торпедоносець і потопив ваш корабель.";
  } else {
    document.querySelector("#statusLabel").innerText = "Суперник використав торпедоносець, але не знайшов кораблів у рядку.";
  }

  renderBattleActionControls();
  updateTurnLabel();
}

function markSunkShipCells(boardType, sunkCells) {
  if (!Array.isArray(sunkCells)) {
    return;
  }

  for (const cell of sunkCells) {
    updateBoardCell(boardType, cell.row, cell.col, "sunk", false);
  }
}

function markSunkZone(boardType, zoneCells) {
  if (!Array.isArray(zoneCells)) {
    return;
  }

  for (const cell of zoneCells) {
    updateBoardCell(boardType, cell.row, cell.col, "sunk-zone", false);
  }
}

function handleGameOver(message) {
  gameFinished = true;
  gamePhase = "FINISHED";

  const resultText = message.winner === playerId
    ? "Ви перемогли!"
    : "Ви програли.";

  stopTurnTimer();
  document.querySelector("#statusLabel").innerText = resultText;
  document.querySelector("#turnLabel").innerText = "Гру завершено";
  updateTurnIndicator();
  renderPlacementControls();
  renderBattleActionControls();
}

function handleEnemyDisconnected(message) {
  gameFinished = true;
  gamePhase = "FINISHED";

  stopTurnTimer();
  document.querySelector("#statusLabel").innerText = message.message;
  document.querySelector("#turnLabel").innerText = "Гру зупинено";
  updateTurnIndicator();
  renderPlacementControls();
  renderBattleActionControls();
}

function handleError(message) {
  document.querySelector("#statusLabel").innerText = message.message;
}

function updateTurnLabel() {
  if (gameFinished) {
    document.querySelector("#turnLabel").innerText = "Гру завершено";
    updateTurnIndicator();
    return;
  }

  const text = currentTurn === playerId ? "Ваш хід" : "Хід суперника";

  document.querySelector("#turnLabel").innerText = text;
  renderBattleActionControls();
  updateTurnIndicator();
}

function handleTurnChanged(message) {
  currentTurn = message.currentTurn;
  turnDeadline = Number(message.turnDeadline || 0) || Date.now() + TURN_SECONDS * 1000;

  if (message.reason === "timeout") {
    document.querySelector("#statusLabel").innerText = currentTurn === playerId
      ? "Суперник не встиг за 25 секунд. Тепер ваш хід."
      : "Час на хід вийшов. Хід переходить супернику.";
  }

  selectedBattleAction = "shot";
  updateTurnLabel();
}

function updateTurnIndicator() {
  const indicator = document.querySelector("#turnIndicator");
  const arrow = document.querySelector("#attackArrow");

  if (!indicator || !arrow) {
    return;
  }

  indicator.classList.remove("turn-indicator-attack", "turn-indicator-defense", "turn-indicator-waiting");
  arrow.classList.remove("attack-arrow-right", "attack-arrow-left", "attack-arrow-waiting");

  if (gamePhase !== "PLAYING" || gameFinished || !currentTurn) {
    indicator.classList.add("turn-indicator-waiting");
    arrow.classList.add("attack-arrow-waiting");
    updateTurnTimerText(TURN_SECONDS);
    stopTurnTimer(false);
    return;
  }

  if (currentTurn === playerId) {
    indicator.classList.add("turn-indicator-attack");
    arrow.classList.add("attack-arrow-right");
  } else {
    indicator.classList.add("turn-indicator-defense");
    arrow.classList.add("attack-arrow-left");
  }

  startTurnTimer();
}

function startTurnTimer() {
  stopTurnTimer(false);

  if (!turnDeadline) {
    turnDeadline = Date.now() + TURN_SECONDS * 1000;
  }

  updateTurnTimer();
  turnTimerInterval = setInterval(updateTurnTimer, 250);
}

function stopTurnTimer(resetText = true) {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }

  if (resetText) {
    turnDeadline = null;
    updateTurnTimerText(TURN_SECONDS);
  }
}

function updateTurnTimer() {
  const secondsLeft = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
  updateTurnTimerText(secondsLeft);
}

function updateTurnTimerText(secondsLeft) {
  const timer = document.querySelector("#turnTimer");

  if (timer) {
    timer.innerText = String(secondsLeft).padStart(2, "0");
  }
}

function placeShip(row, col) {
  console.log("placeShip function called:", row, col, selectedShipSize, selectedDirection);

  if (gameFinished) {
    return;
  }

  if (!playerId || !gameId) {
    document.querySelector("#statusLabel").innerText = "Гра ще не створена";
    return;
  }

  if (gamePhase !== "PLACING_SHIPS") {
    document.querySelector("#statusLabel").innerText = "Зараз не фаза розміщення кораблів";
    return;
  }

  if (getBoardCellValue("me", row, col) === "ship") {
    removeShip(row, col);
    return;
  }

  if (!selectedShipSize || !remainingShips[selectedShipSize]) {
    document.querySelector("#statusLabel").innerText = "Оберіть корабель, який ще залишився";
    return;
  }

  sendMessage({
    type: "PLACE_SHIP",
    gameId: gameId,
    playerId: playerId,
    row: row,
    col: col,
    size: selectedShipSize,
    direction: selectedDirection
  });
}

function removeShip(row, col) {
  sendMessage({
    type: "REMOVE_SHIP",
    gameId: gameId,
    playerId: playerId,
    row: row,
    col: col
  });
}

function handleEnemyBoardAction(row, col) {
  if (selectedBattleAction === "scanner") {
    scanArea(row, col);
    return;
  }

  if (selectedBattleAction === "torpedo") {
    useTorpedoBomber(row);
    return;
  }

  shoot(row, col);
}

function shoot(row, col) {
  console.log("shoot function called:", row, col);

  if (gameFinished) {
    return;
  }

  if (!playerId || !gameId) {
    document.querySelector("#statusLabel").innerText = "Гра ще не почалась";
    return;
  }

  if (gamePhase !== "PLAYING") {
    document.querySelector("#statusLabel").innerText = "Спочатку розмістіть кораблі на лівому полі";
    return;
  }

  if (currentTurn !== playerId) {
    document.querySelector("#statusLabel").innerText = "Зараз не ваш хід";
    return;
  }

  sendMessage({
    type: "SHOT",
    gameId: gameId,
    playerId: playerId,
    row: row,
    col: col
  });
}

function scanArea(row, col) {
  if (!canUseBattleAction()) {
    return;
  }

  if (scannerUsesLeft <= 0) {
    document.querySelector("#statusLabel").innerText = "Сканер уже використано";
    return;
  }

  sendMessage({
    type: "SCAN_AREA",
    gameId: gameId,
    playerId: playerId,
    row: row,
    col: col
  });
}

function useTorpedoBomber(row) {
  if (!canUseBattleAction()) {
    return;
  }

  if (torpedoBombersLeft <= 0) {
    document.querySelector("#statusLabel").innerText = "Торпедоносців більше немає";
    return;
  }

  sendMessage({
    type: "TORPEDO_BOMBER",
    gameId: gameId,
    playerId: playerId,
    row: row
  });
}

function canUseBattleAction() {
  if (gameFinished) {
    return false;
  }

  if (!playerId || !gameId) {
    document.querySelector("#statusLabel").innerText = "Гра ще не почалась";
    return false;
  }

  if (gamePhase !== "PLAYING") {
    document.querySelector("#statusLabel").innerText = "Спочатку розмістіть кораблі на лівому полі";
    return false;
  }

  if (currentTurn !== playerId) {
    document.querySelector("#statusLabel").innerText = "Зараз не ваш хід";
    return false;
  }

  return true;
}

function initBattleActionControls() {
  const shotButton = document.querySelector("#shotButton");
  const scannerButton = document.querySelector("#scannerButton");
  const torpedoButton = document.querySelector("#torpedoButton");

  if (!shotButton || !scannerButton || !torpedoButton) {
    return;
  }

  shotButton.addEventListener("click", function () {
    selectedBattleAction = "shot";
    document.querySelector("#statusLabel").innerText = "Обрано звичайний постріл. Натисніть клітинку на полі суперника.";
    renderBattleActionControls();
  });

  scannerButton.addEventListener("click", function () {
    if (scannerUsesLeft <= 0) {
      document.querySelector("#statusLabel").innerText = "Сканер уже використано";
      return;
    }

    selectedBattleAction = "scanner";
    document.querySelector("#statusLabel").innerText = "Обрано сканер. Натисніть центр зони 3×3 на полі суперника.";
    renderBattleActionControls();
  });

  torpedoButton.addEventListener("click", function () {
    if (torpedoBombersLeft <= 0) {
      document.querySelector("#statusLabel").innerText = "Торпедоносців більше немає";
      return;
    }

    selectedBattleAction = "torpedo";
    document.querySelector("#statusLabel").innerText = "Обрано торпедоносець. Натисніть будь-яку клітинку потрібного рядка.";
    renderBattleActionControls();
  });
}

function renderBattleActionControls() {
  const panel = document.querySelector("#battleActions");
  const shotButton = document.querySelector("#shotButton");
  const scannerButton = document.querySelector("#scannerButton");
  const torpedoButton = document.querySelector("#torpedoButton");

  if (!panel || !shotButton || !scannerButton || !torpedoButton) {
    return;
  }

  const canAct = gamePhase === "PLAYING" && currentTurn === playerId && !gameFinished;

  panel.classList.toggle("battle-actions-disabled", !canAct);
  shotButton.disabled = !canAct;
  scannerButton.disabled = !canAct || scannerUsesLeft <= 0;
  torpedoButton.disabled = !canAct || torpedoBombersLeft <= 0;

  scannerButton.innerText = `Сканер 3×3 ×${scannerUsesLeft}`;
  torpedoButton.innerText = `Торпедоносець ×${torpedoBombersLeft}`;

  shotButton.classList.toggle("active-action-button", selectedBattleAction === "shot");
  scannerButton.classList.toggle("active-action-button", selectedBattleAction === "scanner");
  torpedoButton.classList.toggle("active-action-button", selectedBattleAction === "torpedo");
}

function initPlacementControls() {
  const shipButtons = document.querySelectorAll("[data-ship-size]");

  shipButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const size = Number(button.dataset.shipSize);

      if (!remainingShips[size]) {
        document.querySelector("#statusLabel").innerText = "Кораблів такого розміру більше не залишилось";
        return;
      }

      selectedShipSize = size;
      renderPlacementControls();
      document.querySelector("#statusLabel").innerText =
        `Обрано ${size}-палубний корабель. Натисніть початкову клітинку на лівому полі.`;
    });
  });

  document.querySelector("#directionButton").addEventListener("click", function () {
    selectedDirection = selectedDirection === "horizontal" ? "vertical" : "horizontal";
    renderPlacementControls();
  });
}

function renderPlacementControls() {
  const panel = document.querySelector("#placementPanel");
  const directionButton = document.querySelector("#directionButton");
  const shipButtons = document.querySelectorAll("[data-ship-size]");

  if (!panel || !directionButton) {
    return;
  }

  const isPlacing = gamePhase === "PLACING_SHIPS";

  panel.classList.toggle("placement-panel-disabled", !isPlacing);
  directionButton.disabled = !isPlacing;
  directionButton.innerText = selectedDirection === "horizontal"
    ? "Напрямок: горизонтально"
    : "Напрямок: вертикально";


  shipButtons.forEach(function (button) {
    const size = Number(button.dataset.shipSize);
    const count = remainingShips[size] || 0;

    button.disabled = !isPlacing || count === 0;
    button.innerText = `${size}-палубний ×${count}`;
    button.classList.toggle("active-ship-button", isPlacing && selectedShipSize === size && count > 0);
  });
}

function updatePlacingStatus(shipsPlaced, shipsRequired) {
  document.querySelector("#statusLabel").innerText =
    `Оберіть корабель, напрямок і натисніть клітинку на лівому полі. Розміщено кораблів: ${shipsPlaced}/${shipsRequired}`;
}

function getFirstAvailableShipSize() {
  const sizes = [4, 3, 2, 1];

  return sizes.find(function (size) {
    return remainingShips[size] > 0;
  }) || null;
}

function createRemainingShipsText() {
  return `Залишилось: 4-палубний ×${remainingShips[4] || 0}, `
    + `3-палубний ×${remainingShips[3] || 0}, `
    + `2-палубний ×${remainingShips[2] || 0}, `
    + `1-палубний ×${remainingShips[1] || 0}`;
}


function showTemporaryScannerCells(cells) {
  clearTemporaryScannerCells();

  temporaryScannerCells = cells.map(function (cell) {
    return {
      row: cell.row,
      col: cell.col,
      previousValue: getBoardCellValue("enemy", cell.row, cell.col)
    };
  });

  for (const cell of temporaryScannerCells) {
    updateBoardCell("enemy", cell.row, cell.col, "scanner-ship", false);
  }

  refreshBoard("enemy");

  scannerRevealTimeout = setTimeout(function () {
    clearTemporaryScannerCells();
  }, 3000);
}

function clearTemporaryScannerCells() {
  if (scannerRevealTimeout) {
    clearTimeout(scannerRevealTimeout);
    scannerRevealTimeout = null;
  }

  if (!temporaryScannerCells.length) {
    return;
  }

  for (const cell of temporaryScannerCells) {
    if (getBoardCellValue("enemy", cell.row, cell.col) === "scanner-ship") {
      updateBoardCell("enemy", cell.row, cell.col, cell.previousValue, false);
    }
  }

  temporaryScannerCells = [];
  refreshBoard("enemy");
}

function applyTorpedoCells(boardType, pathCells, sunkCells, zoneCells) {
  for (const cell of pathCells) {
    updateBoardCell(boardType, cell.row, cell.col, cell.result, false);
  }

  markSunkShipCells(boardType, sunkCells);
  markSunkZone(boardType, zoneCells);
  refreshBoard(boardType);
}
