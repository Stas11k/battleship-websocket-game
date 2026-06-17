let socket = null;
let playerId = null;
let gameId = null;

function connectToServer() {
  socket = new WebSocket("ws://localhost:3001");

  socket.addEventListener("open", function () {
    console.log("Connected to WebSocket server");

    sendMessage({
      type: "JOIN_GAME"
    });
  });

  socket.addEventListener("message", function (event) {
    const message = JSON.parse(event.data);

    handleServerMessage(message);
  });

  socket.addEventListener("close", function () {
    console.log("Disconnected from WebSocket server");

    document.querySelector("#statusLabel").innerText = "З'єднання втрачено";
  });

  socket.addEventListener("error", function (error) {
    console.error("WebSocket error:", error);

    document.querySelector("#statusLabel").innerText = "Помилка WebSocket-з'єднання";
  });
}

function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}