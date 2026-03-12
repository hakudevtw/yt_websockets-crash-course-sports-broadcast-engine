import { WebSocketServer, WebSocket } from "ws";

// Spins up its own HTTP server and listens on port 8080 (zombie HTTP server)
// no need for external HTTP server like express
const wss = new WebSocketServer({ port: 8080 });

// Connection Event - fires after the 101 handshake verification
wss.on("connection", (socket, request) => {
  const ip = request.socket.remoteAddress;

  socket.on("message", (rawData) => {
    const message = rawData.toString(); // convert buffer or binary to string
    console.log(rawData);

    wss.clients.forEach((client) => {
      // If you send message to state 2 or 3, the server might throw error or leak memory
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Server Broadcast: ${message}`);
      }
    });

    socket.on("error", (error) => {
      console.error(`Error from ${ip}: ${error.message}`);
    });

    socket.on("close", () => {
      console.log(`Connection from ${ip} closed`);
    });
  });
});

console.log("Server is running on port 8080");
