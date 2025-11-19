import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";

export interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave";
  sessionId: string;
  payload?: any;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private sessions: Map<string, WebSocket> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/api/call/signal" });
    this.wss.on("connection", this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket) {
    console.log("WebRTC signaling client connected");

    ws.on("message", (data: Buffer) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error("Invalid signaling message:", error);
        ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      // Clean up session on disconnect
      for (const [sessionId, socket] of this.sessions.entries()) {
        if (socket === ws) {
          this.sessions.delete(sessionId);
          console.log(`Session ${sessionId} disconnected`);
          break;
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  private handleMessage(ws: WebSocket, message: SignalingMessage) {
    const { type, sessionId, payload } = message;

    switch (type) {
      case "join":
        this.sessions.set(sessionId, ws);
        console.log(`Session ${sessionId} joined signaling`);
        ws.send(JSON.stringify({ type: "joined", sessionId }));
        break;

      case "offer":
      case "answer":
      case "ice-candidate":
        // Echo back to the same client (for now, since we're doing browser-to-server)
        // In a more complex setup, you'd relay to another peer
        ws.send(JSON.stringify({ type, sessionId, payload }));
        break;

      case "leave":
        this.sessions.delete(sessionId);
        console.log(`Session ${sessionId} left`);
        ws.send(JSON.stringify({ type: "left", sessionId }));
        break;

      default:
        ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
    }
  }

  public sendToSession(sessionId: string, message: any) {
    const ws = this.sessions.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public closeSession(sessionId: string) {
    const ws = this.sessions.get(sessionId);
    if (ws) {
      ws.close();
      this.sessions.delete(sessionId);
    }
  }
}

