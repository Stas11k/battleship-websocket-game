const WebSocket = require("ws");

const PORT = 3001;

const wss = new WebSocket.Server({ port: PORT });

wss.on("connection", function (socket) {
  console.log("New player connected");

  socket.on("message", function (data) {
    try {
      const message = JSON.parse(data.toString());
      console.log("Received message:", message);
    } catch (error) {
      console.error("Invalid message:", error.message);
    }
  });

  socket.on("close", function () {
    console.log("Player disconnected");
  });
});

console.log(`WebSocket server started on port ${PORT}`);
