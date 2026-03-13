import { WebSocket, WebSocketServer } from "ws";
import type { Match } from "../types";
import type { Server } from "http";

function sendJson<T = any>(socket: WebSocket, payload: T) {
  if (socket.readyState === WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast<T = any>(wss: WebSocketServer, payload: T) {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(payload));
  });
}

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 * 1024 * 10 });

  wss.on("connection", (socket: WebSocket & { isAlive?: boolean }) => {
    // Matches the approach in the ws readme
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((socket: WebSocket & { isAlive?: boolean }) => {
      // When ping was sent and no pong was received,
      // the client is considered dead
      if (socket.isAlive === false) return socket.terminate();
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match: Match) {
    broadcast(wss, { type: "matchCreated", match });
  }

  return { broadcastMatchCreated };
}
