const {
  createBoard,
  placeShip,
  removeShip,
  checkShot,
  scanArea,
  fireTorpedoBomber,
  isAllShipsDestroyed
} = require("./gameLogic");

let roomCounter = 1;
const FLEET_TEMPLATE = {
  4: 1,
  3: 2,
  2: 3,
  1: 4
};

const TOTAL_SHIPS = Object.values(FLEET_TEMPLATE).reduce(function (total, count) {
  return total + count;
}, 0);
const START_SCANNER_USES = 1;
const START_TORPEDO_BOMBERS = 2;
const TURN_DURATION_MS = 25000;

class GameRoom {
  constructor() {
    this.id = `room-${roomCounter++}`;
    this.players = [];
    this.currentTurn = null;
    this.turnDeadline = null;
    this.turnTimeout = null;
    this.phase = "WAITING_FOR_PLAYERS";
  }

  addPlayer(socket) {
    const player = {
      id: `player${this.players.length + 1}`,
      socket: socket,
      board: createBoard(),
      shipsPlaced: 0,
      remainingShips: createFleet(),
      scannerUsesLeft: START_SCANNER_USES,
      torpedoBombersLeft: START_TORPEDO_BOMBERS,
      ready: false
    };

    this.players.push(player);

    return player;
  }

  isFull() {
    return this.players.length === 2;
  }

  startGame() {
    this.phase = "PLACING_SHIPS";

    for (const player of this.players) {
      player.socket.send(JSON.stringify({
        type: "PLACING_STARTED",
        gameId: this.id,
        playerId: player.id,
        shipsPlaced: player.shipsPlaced,
        shipsRequired: TOTAL_SHIPS,
        remainingShips: player.remainingShips
      }));
    }
  }

  handlePlaceShip(playerId, row, col, size, direction) {
    if (this.phase !== "PLACING_SHIPS") {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Зараз не фаза розміщення кораблів"
      });

      return;
    }

    const player = this.getPlayer(playerId);

    if (!player) {
      return;
    }

    if (player.ready) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Усі кораблі вже розміщено. Очікуйте суперника"
      });

      return;
    }

    const shipSize = Number(size);
    const shipDirection = direction === "vertical" ? "vertical" : "horizontal";

    if (!player.remainingShips[shipSize]) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Кораблів такого розміру більше не залишилось"
      });

      return;
    }

    const result = placeShip(player.board, row, Number(col), shipSize, shipDirection);

    if (!result.success) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: result.message
      });

      return;
    }

    player.remainingShips[shipSize]--;
    player.shipsPlaced += 1;

    player.socket.send(JSON.stringify({
      type: "SHIP_PLACED",
      cells: result.cells,
      size: shipSize,
      direction: shipDirection,
      shipsPlaced: player.shipsPlaced,
      shipsRequired: TOTAL_SHIPS,
      remainingShips: player.remainingShips
    }));

    if (isFleetPlaced(player.remainingShips)) {
      player.ready = true;

      player.socket.send(JSON.stringify({
        type: "PLAYER_READY",
        message: "Ви розмістили всі кораблі. Очікування суперника..."
      }));
    }

    if (this.players.length === 2 && this.players.every(function (player) {
      return player.ready;
    })) {
      this.startBattle();
    }
  }

  handleRemoveShip(playerId, row, col) {
    if (this.phase !== "PLACING_SHIPS") {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Зараз не фаза розміщення кораблів"
      });

      return;
    }

    const player = this.getPlayer(playerId);

    if (!player) {
      return;
    }

    const result = removeShip(player.board, row, Number(col));

    if (!result.success) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: result.message
      });

      return;
    }

    player.remainingShips[result.size] += 1;
    player.shipsPlaced = Math.max(0, player.shipsPlaced - 1);
    player.ready = false;

    player.socket.send(JSON.stringify({
      type: "SHIP_REMOVED",
      cells: result.cells,
      size: result.size,
      shipsPlaced: player.shipsPlaced,
      shipsRequired: TOTAL_SHIPS,
      remainingShips: player.remainingShips
    }));
  }

  startBattle() {
    this.phase = "PLAYING";
    this.setCurrentTurn("player1");

    for (const player of this.players) {
      player.socket.send(JSON.stringify({
        type: "GAME_STARTED",
        gameId: this.id,
        currentTurn: this.currentTurn,
        turnDeadline: this.turnDeadline,
        scannerUsesLeft: player.scannerUsesLeft,
        torpedoBombersLeft: player.torpedoBombersLeft
      }));
    }
  }

  handleShot(playerId, row, col) {
    if (this.phase !== "PLAYING") {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Спочатку потрібно розмістити кораблі"
      });

      return;
    }

    if (playerId !== this.currentTurn) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Зараз не ваш хід"
      });

      return;
    }

    const player = this.getPlayer(playerId);
    const enemy = this.getEnemy(playerId);

    if (!player || !enemy) {
      return;
    }

    const shotResult = checkShot(enemy.board, row, Number(col));

    if (shotResult.result === "already") {
      player.socket.send(JSON.stringify({
        type: "ERROR",
        message: "У цю клітинку вже стріляли"
      }));

      return;
    }

    const nextTurn = shotResult.result === "hit" || shotResult.result === "sunk" ? player.id : enemy.id;
    this.setCurrentTurn(nextTurn);

    player.socket.send(JSON.stringify({
      type: "SHOT_RESULT",
      row: row,
      col: Number(col),
      result: shotResult.result,
      sunkCells: shotResult.sunkCells || [],
      zoneCells: shotResult.zoneCells || [],
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));

    enemy.socket.send(JSON.stringify({
      type: "ENEMY_SHOT",
      row: row,
      col: Number(col),
      result: shotResult.result,
      sunkCells: shotResult.sunkCells || [],
      zoneCells: shotResult.zoneCells || [],
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));

    if (isAllShipsDestroyed(enemy.board)) {
      this.clearTurnTimer();
      this.broadcast({
        type: "GAME_OVER",
        winner: player.id
      });
    }
  }


  handleScanArea(playerId, row, col) {
    if (!this.canUseBattleAction(playerId)) {
      return;
    }

    const player = this.getPlayer(playerId);
    const enemy = this.getEnemy(playerId);

    if (!player || !enemy) {
      return;
    }

    if (player.scannerUsesLeft <= 0) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Сканер уже використано"
      });

      return;
    }

    const scannedCells = scanArea(enemy.board, row, Number(col));
    player.scannerUsesLeft--;

    const nextTurn = enemy.id;
    this.setCurrentTurn(nextTurn);

    player.socket.send(JSON.stringify({
      type: "SCAN_RESULT",
      row: row,
      col: Number(col),
      cells: scannedCells,
      scannerUsesLeft: player.scannerUsesLeft,
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));

    enemy.socket.send(JSON.stringify({
      type: "ENEMY_SCAN_USED",
      row: row,
      col: Number(col),
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));
  }

  handleTorpedoBomber(playerId, row) {
    if (!this.canUseBattleAction(playerId)) {
      return;
    }

    const player = this.getPlayer(playerId);
    const enemy = this.getEnemy(playerId);

    if (!player || !enemy) {
      return;
    }

    if (player.torpedoBombersLeft <= 0) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Торпедоносців більше немає"
      });

      return;
    }

    const torpedoResult = fireTorpedoBomber(enemy.board, row);
    player.torpedoBombersLeft--;

    const nextTurn = enemy.id;
    this.setCurrentTurn(nextTurn);

    player.socket.send(JSON.stringify({
      type: "TORPEDO_RESULT",
      row: row,
      result: torpedoResult.result,
      pathCells: torpedoResult.pathCells || [],
      sunkCells: torpedoResult.sunkCells || [],
      zoneCells: torpedoResult.zoneCells || [],
      torpedoBombersLeft: player.torpedoBombersLeft,
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));

    enemy.socket.send(JSON.stringify({
      type: "ENEMY_TORPEDO_USED",
      row: row,
      result: torpedoResult.result,
      pathCells: torpedoResult.pathCells || [],
      sunkCells: torpedoResult.sunkCells || [],
      zoneCells: torpedoResult.zoneCells || [],
      nextTurn: nextTurn,
      turnDeadline: this.turnDeadline
    }));

    if (isAllShipsDestroyed(enemy.board)) {
      this.clearTurnTimer();
      this.broadcast({
        type: "GAME_OVER",
        winner: player.id
      });
    }
  }

  canUseBattleAction(playerId) {
    if (this.phase !== "PLAYING") {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Спочатку потрібно розмістити кораблі"
      });

      return false;
    }

    if (playerId !== this.currentTurn) {
      this.sendToPlayer(playerId, {
        type: "ERROR",
        message: "Зараз не ваш хід"
      });

      return false;
    }

    return true;
  }

  setCurrentTurn(playerId) {
    this.clearTurnTimer();
    this.currentTurn = playerId;

    if (this.phase !== "PLAYING") {
      this.turnDeadline = null;
      return;
    }

    this.turnDeadline = Date.now() + TURN_DURATION_MS;
    this.turnTimeout = setTimeout(() => {
      this.handleTurnTimeout();
    }, TURN_DURATION_MS);
  }

  clearTurnTimer() {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
  }

  handleTurnTimeout() {
    if (this.phase !== "PLAYING" || !this.currentTurn || this.players.length < 2) {
      return;
    }

    const enemy = this.getEnemy(this.currentTurn);

    if (!enemy) {
      return;
    }

    this.setCurrentTurn(enemy.id);
    this.broadcast({
      type: "TURN_CHANGED",
      reason: "timeout",
      currentTurn: this.currentTurn,
      turnDeadline: this.turnDeadline
    });
  }

  getPlayer(playerId) {
    return this.players.find(function (player) {
      return player.id === playerId;
    });
  }

  getEnemy(playerId) {
    return this.players.find(function (player) {
      return player.id !== playerId;
    });
  }

  sendToPlayer(playerId, message) {
    const player = this.getPlayer(playerId);

    if (player) {
      player.socket.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    for (const player of this.players) {
      player.socket.send(JSON.stringify(message));
    }
  }

  removePlayer(playerId) {
    this.clearTurnTimer();
    const enemy = this.getEnemy(playerId);

    if (enemy) {
      enemy.socket.send(JSON.stringify({
        type: "ENEMY_DISCONNECTED",
        message: "Суперник відключився"
      }));
    }

    this.players = this.players.filter(function (player) {
      return player.id !== playerId;
    });
  }
}

function createFleet() {
  return Object.assign({}, FLEET_TEMPLATE);
}

function isFleetPlaced(remainingShips) {
  return Object.values(remainingShips).every(function (count) {
    return count === 0;
  });
}

module.exports = { GameRoom };