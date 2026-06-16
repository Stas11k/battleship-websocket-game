const {
  createPlayerState,
  placeShip
} = require("./gameLogic");

class GameRoom {
  constructor() {
    this.id = this.createRoomId();

    this.player1 = null;
    this.player2 = null;

    this.player1State = createPlayerState();
    this.player2State = createPlayerState();

    this.phase = "WAITING_FOR_PLAYERS";
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

      case "PLAYER_READY":
        this.handlePlayerReady(socket);
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

  startPlacementPhase() {
    this.phase = "PLACING_SHIPS";

    this.broadcast({
      type: "PLACING_STARTED"
    });
  }

  startBattlePhase() {
    this.phase = "BATTLE";

    this.broadcast({
      type: "GAME_STARTED"
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