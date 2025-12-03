import { WebSocket } from "ws";
import { voiceCallService } from "../voiceCallService";

export interface CallMessage {
  type:
    | "start_call"
    | "audio_data"
    | "end_call"
    | "transcript_update"
    | "ai_response"
    | "call_ended"
    | "error";
  sessionId?: string;
  payload?: any;
}

export class CallWebSocketHandler {
  private ws: WebSocket;
  private sessionId: string | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupListeners();
  }

  private setupListeners() {
    this.ws.on("message", (data: Buffer) => {
      try {
        // Check if it's JSON (control message) or binary (audio data)
        if (data[0] === 0x7b) {
          // Starts with '{' - JSON
          const message: CallMessage = JSON.parse(data.toString());
          this.handleControlMessage(message);
        } else {
          // Binary audio data
          this.handleAudioData(data);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        console.error("Data type:", typeof data, "Length:", data.length, "First byte:", data[0]);
        // Don't send error to frontend for audio data parsing issues
        // Only log it for debugging
      }
    });

    this.ws.on("close", () => {
      if (this.sessionId) {
        voiceCallService.endCall(this.sessionId, "websocket_closed");
      }
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      if (this.sessionId) {
        voiceCallService.endCall(this.sessionId, "websocket_error");
      }
    });
  }

  private handleControlMessage(message: CallMessage) {
    const { type, sessionId, payload } = message;

    switch (type) {
      case "start_call":
        if (!sessionId) {
          this.sendError("sessionId required");
          return;
        }
        this.startCall(sessionId);
        break;

      case "end_call":
        if (this.sessionId) {
          voiceCallService.endCall(this.sessionId, "user_hangup");
        }
        break;

      default:
        this.sendError("Unknown message type");
    }
  }

  private startCall(sessionId: string) {
    try {
      this.sessionId = sessionId;

      voiceCallService.startCall(sessionId, {
        onAudioOut: (audioChunk: Buffer) => {
          // Send audio back to client
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(audioChunk);
          }
        },
        onTranscriptUpdate: (transcript: string, isFinal: boolean) => {
          // Send transcript update to client
          this.send({
            type: "transcript_update",
            sessionId,
            payload: { transcript, isFinal },
          });
        },
        onAIResponse: (text: string) => {
          // Send AI response text to client
          this.send({
            type: "ai_response",
            sessionId,
            payload: { text },
          });
        },
        onCallEnd: (reason: string) => {
          // Notify client that call ended
          this.send({
            type: "call_ended",
            sessionId,
            payload: { reason },
          });
          this.ws.close();
        },
      });

      this.send({
        type: "start_call",
        sessionId,
        payload: { success: true },
      });
    } catch (error) {
      console.error("Error starting call:", error);
      this.sendError(
        error instanceof Error ? error.message : "Failed to start call"
      );
    }
  }

  private handleAudioData(audioData: Buffer) {
    if (!this.sessionId) {
      this.sendError("Call not started");
      return;
    }

    try {
      voiceCallService.processAudio(this.sessionId, audioData);
    } catch (error) {
      console.error("Error processing audio:", error);
      this.sendError("Failed to process audio");
    }
  }

  private send(message: CallMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendError(error: string) {
    const message: CallMessage = {
      type: "error",
      payload: { error },
    };
    if (this.sessionId) {
      message.sessionId = this.sessionId;
    }
    this.send(message);
  }
}

