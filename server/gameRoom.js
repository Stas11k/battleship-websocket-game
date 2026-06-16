class GameRoom {
  constructor() {
    this.id = this.createRoomId();

    this.player1 = null;
    this.player2 = null;

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

  startPlacementPhase() {
    this.phase = "PLACING_SHIPS";

    this.broadcast({
      type: "PLACING_STARTED"
    });
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