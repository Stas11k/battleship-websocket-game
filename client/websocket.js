let socket = null;

function connectToServer() {
  socket = new WebSocket("ws://localhost:3001");

  socket.addEventListener("open", function () {
    setConnectionStatus("Підключено");

    sendMessage({
      type: "JOIN_GAME"
    });
  });

  socket.addEventListener("message", function (event) {
    try {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    } catch (error) {
      console.error("Invalid server message:", error);
    }
  });

  socket.addEventListener("close", function () {
    setConnectionStatus("Відключено");
  });

  socket.addEventListener("error", function () {
    setConnectionStatus("Помилка з'єднання");
  });
}

function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("Socket is not connected");
    return;
  }

  socket.send(JSON.stringify(message));
}