import express from "express";
import { attachWebSocketServer } from "./ws/server";
import { matchesRouter } from "./routes/matches";
import { commentaryRoutes } from "./routes/commentary";
import http from "http";
// import { securityMiddleware } from "./arcjet";

const PORT = Number(process.env.PORT ?? 8000);
const HOST = process.env.HOST ?? "0.0.0.0";

// A function that handles HTTP requests
const app = express();

// Creates real TCP/HTTP server that uses app to handle requests
// Needed for websocket to hook into the same PORT
const server = http.createServer(app);

app.use(express.json());
app.use("/matches", matchesRouter);
app.use("/matches/:id/commentary", commentaryRoutes);
// app.use(securityMiddleware);

// WebSocket connections start as an HTTP request with Upgrade:websocket header
// The WebSocket server must be attached to the same server that receives that request so it can handle the upgrade and then take over the connection.
const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl = HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace("http", "ws")}/ws`);
});

// You can't get the reference to the server app.listen(...) creates
// so you can't use it to attach the WebSocket server.
