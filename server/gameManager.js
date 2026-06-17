const { GameRoom } = require("./gameRoom");

class GameManager {
  constructor() {
    this.rooms = [];
  }

  joinGame(socket) {
    let room = this.rooms.find(function (room) {
      return !room.isFull();
    });

    if (!room) {
      room = new GameRoom();
      this.rooms.push(room);
    }

    const player = room.addPlayer(socket);

    socket.room = room;
    socket.playerId = player.id;

    socket.send(JSON.stringify({
      type: "GAME_JOINED",
      gameId: room.id,
      playerId: player.id
    }));

    if (room.isFull()) {
      room.startGame();
    }
  }

  handlePlaceShip(socket, message) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.handlePlaceShip(socket.playerId, message.row, message.col, message.size, message.direction);
  }

  handleRemoveShip(socket, message) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.handleRemoveShip(socket.playerId, message.row, message.col);
  }

  handleShot(socket, message) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.handleShot(socket.playerId, message.row, message.col);
  }

  handleScanArea(socket, message) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.handleScanArea(socket.playerId, message.row, message.col);
  }

  handleTorpedoBomber(socket, message) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.handleTorpedoBomber(socket.playerId, message.row);
  }

  removePlayer(socket) {
    const room = socket.room;

    if (!room) {
      return;
    }

    room.removePlayer(socket.playerId);

    this.rooms = this.rooms.filter(function (room) {
      return room.players.length > 0;
    });
  }
}

module.exports = { GameManager };