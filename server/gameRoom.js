const {
  createPlayerState,
  placeShip,
  removeShip,
  checkShot
} = require("./gameLogic");

class GameRoom {
  constructor() {
    this.id = this.createRoomId();

    this.player1 = null;
    this.player2 = null;

    this.player1State = createPlayerState();
    this.player2State = createPlayerState();

    this.phase = "WAITING_FOR_PLAYERS";
    this.currentTurn = 1;
  }

  addPlayer(socket) {
    if (!this.player1) {
      this.player1 = socket;
      socket.roomPlayerNumber = 1;
      return 1;
    }

    if (!this.player2) {
      this.player2 = socket;
      socket.roomPlayerNumber = 2;
      return 2;
    }

    return null;
  }

  handleMessage(socket, message) {
    switch (message.type) {
      case "PLACE_SHIP":
        this.handlePlaceShip(socket, message);
        break;

      case "REMOVE_SHIP":
        this.handleRemoveShip(socket, message);
        break;

      case "PLAYER_READY":
        this.handlePlayerReady(socket);
        break;

      case "SHOT":
        this.handleShot(socket, message);
        break;

      default:
        this.sendToPlayer(socket, {
          type: "ERROR",
          message: "Unknown room message type"
        });
        break;
    }
  }

  handlePlaceShip(socket, message) {
    if (this.phase !== "PLACING_SHIPS") {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Ships can be placed only during placement phase"
      });
      return;
    }

    const playerState = this.getPlayerState(socket);

    if (!playerState) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Player is not in this room"
      });
      return;
    }

    const result = placeShip(
      playerState,
      message.row,
      Number(message.col),
      Number(message.size),
      message.direction
    );

    if (!result.success) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: result.message
      });
      return;
    }

    this.sendToPlayer(socket, {
      type: "SHIP_PLACED",
      shipId: result.shipId,
      cells: result.cells,
      size: Number(message.size),
      ready: result.ready,
      shipsPlaced: playerState.shipsPlaced
    });

    if (result.ready) {
      this.sendToPlayer(socket, {
        type: "PLAYER_READY",
        message: "All ships placed"
      });
    }
  }

  handleRemoveShip(socket, message) {
    if (this.phase !== "PLACING_SHIPS") {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Ships can be removed only during placement phase"
      });
      return;
    }

    const playerState = this.getPlayerState(socket);

    if (!playerState) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Player is not in this room"
      });
      return;
    }

    const result = removeShip(
      playerState,
      message.row,
      Number(message.col)
    );

    if (!result.success) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: result.message
      });
      return;
    }

    this.sendToPlayer(socket, {
      type: "SHIP_REMOVED",
      shipId: result.shipId,
      size: result.size,
      cells: result.cells,
      ready: result.ready,
      shipsPlaced: result.shipsPlaced
    });
  }

  handlePlayerReady(socket) {
    const playerState = this.getPlayerState(socket);

    if (!playerState) {
      return;
    }

    playerState.ready = true;

    if (this.player1State.ready && this.player2State.ready) {
      this.startBattlePhase();
    }
  }

  handleShot(socket, message) {
    if (this.phase !== "BATTLE") {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Shots are allowed only during battle"
      });
      return;
    }

    const shooterNumber = socket.roomPlayerNumber;

    if (shooterNumber !== this.currentTurn) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "It is not your turn"
      });
      return;
    }

    const enemyState = this.getEnemyState(socket);
    const enemyPlayer = this.getEnemyPlayer(socket);

    if (!enemyState || !enemyPlayer) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: "Enemy player was not found"
      });
      return;
    }

    const result = checkShot(
      enemyState,
      message.row,
      Number(message.col)
    );

    if (!result.success) {
      this.sendToPlayer(socket, {
        type: "ERROR",
        message: result.message
      });
      return;
    }

    const nextTurn = result.result === "hit"
      ? shooterNumber
      : this.getOpponentNumber(shooterNumber);

    this.currentTurn = nextTurn;

    this.sendToPlayer(socket, {
      type: "SHOT_RESULT",
      row: result.row,
      col: result.col,
      result: result.result,
      sunk: result.sunk || false,
      currentTurn: this.currentTurn
    });

    this.sendToPlayer(enemyPlayer, {
      type: "ENEMY_SHOT",
      row: result.row,
      col: result.col,
      result: result.result,
      sunk: result.sunk || false,
      currentTurn: this.currentTurn
    });

    if (result.gameOver) {
      this.phase = "GAME_OVER";

      this.sendToPlayer(socket, {
        type: "GAME_OVER",
        result: "win"
      });

      this.sendToPlayer(enemyPlayer, {
        type: "GAME_OVER",
        result: "lose"
      });
    }
  }

  startPlacementPhase() {
    this.phase = "PLACING_SHIPS";

    this.broadcast({
      type: "PLACING_STARTED"
    });
  }

  startBattlePhase() {
    this.phase = "BATTLE";
    this.currentTurn = 1;

    this.broadcast({
      type: "GAME_STARTED",
      currentTurn: this.currentTurn
    });
  }

  getPlayerState(socket) {
    if (socket === this.player1) {
      return this.player1State;
    }

    if (socket === this.player2) {
      return this.player2State;
    }

    return null;
  }

  getEnemyState(socket) {
    if (socket === this.player1) {
      return this.player2State;
    }

    if (socket === this.player2) {
      return this.player1State;
    }

    return null;
  }

  getEnemyPlayer(socket) {
    if (socket === this.player1) {
      return this.player2;
    }

    if (socket === this.player2) {
      return this.player1;
    }

    return null;
  }

  getOpponentNumber(playerNumber) {
    return playerNumber === 1 ? 2 : 1;
  }

  removePlayer(socket) {
    if (this.player1 === socket) {
      this.player1 = null;
    }

    if (this.player2 === socket) {
      this.player2 = null;
    }

    this.phase = "WAITING_FOR_PLAYERS";

    this.broadcast({
      type: "PLAYER_DISCONNECTED"
    });
  }

  isFull() {
    return this.player1 !== null && this.player2 !== null;
  }

  isEmpty() {
    return this.player1 === null && this.player2 === null;
  }

  broadcast(message) {
    this.sendToPlayer(this.player1, message);
    this.sendToPlayer(this.player2, message);
  }

  sendToPlayer(player, message) {
    if (!player) {
      return;
    }

    if (player.readyState !== 1) {
      return;
    }

    player.send(JSON.stringify(message));
  }

  createRoomId() {
    return `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

module.exports = GameRoom;