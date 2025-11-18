import { Router } from "express";
import { getSession } from "../store/sessionStore";
import { sendChatMessage } from "../services/chatService";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res
      .status(400)
      .json({ error: "sessionId and message are required" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    await sendChatMessage(sessionId, message, (chunk) => {
      sendEvent({ type: "chunk", content: chunk });
    });

    sendEvent({
      type: "done",
      sessionId,
      history: session.history,
    });
    res.end();
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Internal server error";
    sendEvent({ type: "error", error: messageText });
    res.end();
  }
});
