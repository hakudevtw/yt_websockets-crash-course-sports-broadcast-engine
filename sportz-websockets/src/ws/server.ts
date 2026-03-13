import { WebSocket, WebSocketServer } from "ws";
import type { Match, Commentary } from "../types";
import type { Server } from "http";
import { wsArcjet } from "../arcjet";

const matchSubscribers = new Map<number, Set<WebSocket>>();

function subscribe(matchId: number, socket: WebSocket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId)?.add(socket);
}

function unsubscribe(matchId: number, socket: WebSocket) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscribers(socket: WebSocket & { subscriptions: Set<number> }) {
  socket.subscriptions.forEach((matchId) => {
    unsubscribe(matchId, socket);
  });
}

function sendJson<T = any>(socket: WebSocket, payload: T) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll<T = any>(wss: WebSocketServer, payload: T) {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(payload));
  });
}

function broadcastToMatch<T = any>(matchId: number, payload: T) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const subscriber of subscribers) {
    if (subscriber.readyState === WebSocket.OPEN) {
      subscriber.send(message);
    }
  }
}

function handleMessage(socket: WebSocket & { subscriptions: Set<number> }, data: any) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    console.error("Invalid JSON", error);
    sendJson(socket, { type: "error", message: "Invalid JSON" });
  }

  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(message.matchId, socket);
    console.log("Subscribed to match", message.matchId);
    socket.subscriptions.add(message.matchId);
    sendJson(socket, { type: "subscribed", matchId: message.matchId });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
  }
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

  wss.on(
    "connection",
    async (socket: WebSocket & { isAlive?: boolean; subscriptions: Set<number> }, req) => {
      socket.isAlive = true;
      socket.on("pong", () => {
        socket.isAlive = true;
      });

      socket.subscriptions = new Set();

      sendJson(socket, { type: "welcome" });

      socket.on("message", (data) => {
        handleMessage(socket, data);
      });

      socket.on("error", () => {
        socket.terminate();
      });

      socket.on("close", () => {
        cleanupSubscribers(socket);
      });

      socket.on("error", console.error);
    },
  );

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
    broadcastToAll(wss, { type: "matchCreated", match });
  }

  function broadcastCommentary(matchId: number, commentary: Commentary) {
    broadcastToMatch(matchId, { type: "commentary", commentary });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
