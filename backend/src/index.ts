import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config";
import { sessionRouter } from "./routes/sessionRoutes";
import { chatRouter } from "./routes/chatRoutes";
import { callRouter } from "./routes/callRoutes";
import { CallWebSocketHandler } from "./services/webrtc/CallWebSocketHandler";

const app = express();
const httpServer = createServer(app);

// Initialize voice call WebSocket server
const callWss = new WebSocketServer({
  server: httpServer,
  path: "/api/call/ws",
  verifyClient: (info: any) => {
    console.log("WebSocket verification - URL:", info.req.url);
    return info.req.url === "/api/call/ws";
  },
});

callWss.on("connection", (ws, req) => {
  console.log(
    "✅ Voice call WebSocket client connected from:",
    req.headers.origin
  );
  new CallWebSocketHandler(ws);
});

callWss.on("error", (error) => {
  console.error("❌ WebSocket server error:", error);
});

app.use(cors());
app.use(express.json());
httpServer.on("upgrade", (request, socket, head) => {
  console.log("WebSocket upgrade request from:", request.headers.origin);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/session", sessionRouter);
app.use("/api/chat", chatRouter);
app.use("/api/call", callRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
  console.log(
    `WebSocket server ready at ws://localhost:${config.port}/api/call/ws`
  );
});
