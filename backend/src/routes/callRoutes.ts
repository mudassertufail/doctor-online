import { Router } from "express";
import { getSession } from "../store/sessionStore";
import { voiceCallService } from "../services/voiceCallService";

export const callRouter = Router();

/**
 * POST /api/call/start
 * Initialize a voice call session
 */
callRouter.post("/start", (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (voiceCallService.isCallActive(sessionId)) {
      return res.status(400).json({ error: "Call already active" });
    }

    // Return success - actual call setup happens via WebSocket
    return res.json({
      success: true,
      message: "Ready to connect. Please establish WebSocket connection.",
      sessionId,
    });
  } catch (error) {
    console.error("Error starting call:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to start call",
    });
  }
});

/**
 * POST /api/call/end
 * Manually end a voice call
 */
callRouter.post("/end", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    await voiceCallService.endCall(sessionId, "user_hangup");

    return res.json({ success: true, message: "Call ended" });
  } catch (error) {
    console.error("Error ending call:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to end call",
    });
  }
});

/**
 * GET /api/call/status/:sessionId
 * Check if a call is active
 */
callRouter.get("/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const isActive = voiceCallService.isCallActive(sessionId);
  
  return res.json({ sessionId, isActive });
});

