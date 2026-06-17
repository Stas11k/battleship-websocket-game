const WebSocket = require("ws");
const { GameManager } = require("./gameManager");

const PORT = 3001;

const wss = new WebSocket.Server({ port: PORT });
const gameManager = new GameManager();

wss.on("connection", function (socket) {
  console.log("New player connected");

  socket.on("message", function (data) {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(socket, message);
    } catch (error) {
      console.error("Invalid message:", error.message);
    }
  });

  socket.on("close", function () {
    gameManager.removePlayer(socket);
  });
});

function handleMessage(socket, message) {
  switch (message.type) {
    case "JOIN_GAME":
      gameManager.joinGame(socket);
      break;

    case "PLACE_SHIP":
      gameManager.handlePlaceShip(socket, message);
      break;

    case "REMOVE_SHIP":
      gameManager.handleRemoveShip(socket, message);
      break;

    case "SHOT":
      gameManager.handleShot(socket, message);
      break;

    case "SCAN_AREA":
      gameManager.handleScanArea(socket, message);
      break;

    case "TORPEDO_BOMBER":
      gameManager.handleTorpedoBomber(socket, message);
      break;

    default:
      console.log("Unknown message type:", message.type);
  }
}

console.log(`WebSocket server started on port ${PORT}`);
