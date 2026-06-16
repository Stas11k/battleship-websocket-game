const GameRoom = require("./gameRoom");

class GameManager {
  constructor() {
    this.rooms = [];
    this.playerRooms = new Map();
  }

  addPlayer(socket) {
    socket.playerId = this.createPlayerId();

    socket.send(JSON.stringify({
      type: "CONNECTED",
      playerId: socket.playerId
    }));
  }

  handleMessage(socket, message) {
    switch (message.type) {
      case "JOIN_GAME":
        this.joinGame(socket);
        break;

      default:
        socket.send(JSON.stringify({
          type: "ERROR",
          message: "Unknown message type"
        }));
        break;
    }
  }

  joinGame(socket) {
    let room = this.findAvailableRoom();

    if (!room) {
      room = new GameRoom();
      this.rooms.push(room);
    }

    const playerNumber = room.addPlayer(socket);

    this.playerRooms.set(socket, room);

    socket.send(JSON.stringify({
      type: "GAME_JOINED",
      roomId: room.id,
      playerNumber: playerNumber
    }));

    if (room.isFull()) {
      room.startPlacementPhase();
    }
  }

  removePlayer(socket) {
    const room = this.playerRooms.get(socket);

    if (!room) {
      return;
    }

    room.removePlayer(socket);
    this.playerRooms.delete(socket);

    if (room.isEmpty()) {
      this.rooms = this.rooms.filter(function (currentRoom) {
        return currentRoom !== room;
      });
    }
  }

  findAvailableRoom() {
    return this.rooms.find(function (room) {
      return !room.isFull();
    });
  }

  createPlayerId() {
    return `player-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

module.exports = GameManager;