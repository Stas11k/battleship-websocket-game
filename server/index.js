const WebSocket = require("ws");
const GameManager = require("./gameManager");

const PORT = 3001;

const wss = new WebSocket.Server({ port: PORT });
const gameManager = new GameManager();

wss.on("connection", function (socket) {
  console.log("New player connected");

  gameManager.addPlayer(socket);

  socket.on("message", function (data) {
    try {
      const message = JSON.parse(data.toString());
      gameManager.handleMessage(socket, message);
    } catch (error) {
      console.error("Invalid message:", error.message);

      socket.send(JSON.stringify({
        type: "ERROR",
        message: "Invalid message format"
      }));
    }
  });

  socket.on("close", function () {
    console.log("Player disconnected");
    gameManager.removePlayer(socket);
  });
});

console.log(`WebSocket server started on port ${PORT}`);
