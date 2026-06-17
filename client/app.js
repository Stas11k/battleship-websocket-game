const SHIPS_CONFIG = {
  4: 1,
  3: 2,
  2: 3,
  1: 4
};

let playerId = null;
let playerNumber = null;
let selectedShipSize = null;
let selectedDirection = "horizontal";
let gamePhase = "WAITING_FOR_CONNECTION";
let currentTurn = null;

let shipsLeft = {
  4: 1,
  3: 2,
  2: 3,
  1: 4
};

window.addEventListener("DOMContentLoaded", function () {
  initPlacementControls();
  updateShipsLeftView();
  connectToServer();
});

function initPlacementControls() {
  const shipButtons = document.querySelectorAll(".ship-button");

  shipButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const size = Number(button.dataset.size);
      selectShip(size);
    });
  });

  const directionButton = document.getElementById("directionButton");

  directionButton.addEventListener("click", function () {
    toggleDirection();
  });
}

function selectShip(size) {
  if (shipsLeft[size] <= 0) {
    return;
  }

  selectedShipSize = size;

  document.querySelectorAll(".ship-button").forEach(function (button) {
    button.classList.remove("active");
  });

  const activeButton = document.querySelector(`.ship-button[data-size="${size}"]`);

  if (activeButton) {
    activeButton.classList.add("active");
  }
}

function toggleDirection() {
  selectedDirection = selectedDirection === "horizontal" ? "vertical" : "horizontal";

  const directionButton = document.getElementById("directionButton");

  directionButton.textContent = selectedDirection === "horizontal"
    ? "Напрямок: горизонтально"
    : "Напрямок: вертикально";
}

function handleMyBoardCellClick(row, col) {
  if (gamePhase !== "PLACING_SHIPS") {
    return;
  }

  const cellValue = getBoardCellValue("me", row, col);

  if (cellValue === "ship") {
    sendMessage({
      type: "REMOVE_SHIP",
      row: row,
      col: col
    });

    return;
  }

  if (!selectedShipSize) {
    setGameStatus("Оберіть корабель");
    return;
  }

  if (shipsLeft[selectedShipSize] <= 0) {
    setGameStatus("Кораблів цього типу більше немає");
    return;
  }

  sendMessage({
    type: "PLACE_SHIP",
    row: row,
    col: col,
    size: selectedShipSize,
    direction: selectedDirection
  });
}

function handleEnemyBoardCellClick(row, col) {
  if (gamePhase !== "BATTLE") {
    return;
  }

  if (currentTurn !== playerNumber) {
    setGameStatus("Зараз хід суперника");
    return;
  }

  const cellValue = getBoardCellValue("enemy", row, col);

  if (
    cellValue === "hit" ||
    cellValue === "miss" ||
    cellValue === "sunk" ||
    cellValue === "sunk-zone"
  ) {
    setGameStatus("Ви вже стріляли в цю клітинку");
    return;
  }

  sendMessage({
    type: "SHOT",
    row: row,
    col: col
  });
}

function handleServerMessage(message) {
  console.log("Server message:", message);

  switch (message.type) {
    case "CONNECTED":
      handleConnected(message);
      break;

    case "GAME_JOINED":
      handleGameJoined(message);
      break;

    case "PLACING_STARTED":
      handlePlacingStarted();
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

    case "ENEMY_SHOT":
      handleEnemyShot(message);
      break;

    case "GAME_OVER":
      handleGameOver(message);
      break;

    case "ERROR":
      setGameStatus(message.message);
      break;

    default:
      console.warn("Unknown message type:", message.type);
      break;
  }
}

function handleConnected(message) {
  playerId = message.playerId;
  setConnectionStatus("Підключено");
}

function handleGameJoined(message) {
  playerNumber = message.playerNumber;

  document.getElementById("playerInfo").textContent = `Гравець: ${playerNumber}`;
  setGameStatus("Очікування другого гравця...");
}

function handlePlacingStarted() {
  gamePhase = "PLACING_SHIPS";
  setGameStatus("Розмістіть кораблі");
}

function handleShipPlaced(message) {
  for (const cell of message.cells) {
    updateBoardCell("me", cell.row, cell.col, "ship", false);
  }

  refreshBoard("me");

  const size = Number(message.size);

  if (shipsLeft[size] > 0) {
    shipsLeft[size] -= 1;
  }

  updateShipsLeftView();

  if (shipsLeft[size] <= 0 && selectedShipSize === size) {
    selectedShipSize = null;
    clearActiveShipButton();
  }

  if (message.ready) {
    setGameStatus("Усі кораблі розміщено. Очікування суперника...");
  }
}

function handleShipRemoved(message) {
  for (const cell of message.cells) {
    updateBoardCell("me", cell.row, cell.col, "empty", false);
  }

  refreshBoard("me");

  const size = Number(message.size);

  shipsLeft[size] += 1;

  updateShipsLeftView();
  setGameStatus("Корабель прибрано");

  if (selectedShipSize === null) {
    selectShip(size);
  }
}

function handlePlayerReady() {
  setGameStatus("Усі кораблі розміщено. Очікування суперника...");
}

function handleGameStarted(message) {
  gamePhase = "BATTLE";
  currentTurn = message.currentTurn;

  clearActiveShipButton();

  if (currentTurn === playerNumber) {
    setGameStatus("Гру розпочато. Ваш хід");
  } else {
    setGameStatus("Гру розпочато. Хід суперника");
  }
}

function handleShotResult(message) {
  currentTurn = message.currentTurn;

  updateBoardCell("enemy", message.row, message.col, message.result, false);

  if (message.sunk) {
    applySunkCells("enemy", message.sunkCells);
    applySunkZoneCells("enemy", message.zoneCells);
  }

  refreshBoard("enemy");

  if (message.sunk) {
    setGameStatus("Корабель знищено! Ваш хід ще раз");
    return;
  }

  if (message.result === "hit") {
    setGameStatus("Попадання! Ваш хід ще раз");
  } else {
    setGameStatus("Промах. Хід суперника");
  }
}

function handleEnemyShot(message) {
  currentTurn = message.currentTurn;

  updateBoardCell("me", message.row, message.col, message.result, false);

  if (message.sunk) {
    applySunkCells("me", message.sunkCells);
    applySunkZoneCells("me", message.zoneCells);
  }

  refreshBoard("me");

  if (message.sunk) {
    setGameStatus("Ваш корабель знищено. Суперник ходить ще раз");
    return;
  }

  if (message.result === "hit") {
    setGameStatus("У ваш корабель влучили. Суперник ходить ще раз");
  } else {
    setGameStatus("Суперник промахнувся. Ваш хід");
  }
}

function applySunkCells(boardType, cells) {
  if (!Array.isArray(cells)) {
    return;
  }

  for (const cell of cells) {
    updateBoardCell(boardType, cell.row, cell.col, "sunk", false);
  }
}

function applySunkZoneCells(boardType, cells) {
  if (!Array.isArray(cells)) {
    return;
  }

  for (const cell of cells) {
    const currentValue = getBoardCellValue(boardType, cell.row, cell.col);

    if (currentValue === "sunk") {
      continue;
    }

    updateBoardCell(boardType, cell.row, cell.col, "sunk-zone", false);
  }
}

function handleGameOver(message) {
  gamePhase = "GAME_OVER";

  if (message.result === "win") {
    setGameStatus("Ви перемогли!");
  } else {
    setGameStatus("Ви програли!");
  }
}

function updateShipsLeftView() {
  document.getElementById("shipsLeft4").textContent = shipsLeft[4];
  document.getElementById("shipsLeft3").textContent = shipsLeft[3];
  document.getElementById("shipsLeft2").textContent = shipsLeft[2];
  document.getElementById("shipsLeft1").textContent = shipsLeft[1];
}

function clearActiveShipButton() {
  document.querySelectorAll(".ship-button").forEach(function (button) {
    button.classList.remove("active");
  });
}

function setGameStatus(text) {
  document.getElementById("gameStatus").textContent = text;
}

function setConnectionStatus(text) {
  document.getElementById("connectionStatus").textContent = text;
}