import { WebSocket, WebSocketServer } from "ws";
import type { Match } from "../types";
import type { Server } from "http";
import { wsArcjet } from "../arcjet";

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
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024 * 10,
  });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "", `http://${req.headers.host}`);

    if (pathname !== "/ws") {
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req as any);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          }
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error("WS upgrade protection error", e);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (socket: WebSocket & { isAlive?: boolean }, req) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });

    socket.on("error", () => {
      socket.terminate();
    });

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
