import { Ollama } from "ollama";
import { config } from "../config";
import { appendMessage, getSession } from "../store/sessionStore";
import { SYSTEM_PROMPT } from "../constants";
import { ChatMessage } from "../types";

const client = new Ollama({
  host: config.ollamaHost,
});

export const sendChatMessage = async (
  sessionId: string,
  content: string,
  onChunk?: (text: string) => void
) => {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const userMessage: ChatMessage = {
    role: "user",
    content,
    timestamp: Date.now(),
  };
  appendMessage(sessionId, userMessage);

  const conversation = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...session.history
      .filter((message) => message.role !== "system")
      .map(({ role, content }) => ({
        role,
        content,
      })),
  ];

  const stream = await client.chat({
    model: config.ollamaModel,
    messages: conversation,
    stream: true,
  });

  let fullReply = "";
  for await (const part of stream) {
    const delta = part.message?.content ?? "";
    if (!delta) continue;
    fullReply += delta;
    onChunk?.(delta);
  }

  const replyContent = fullReply.trim();

  if (!replyContent) {
    throw new Error("Empty response from model");
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: replyContent,
    timestamp: Date.now(),
  };

  appendMessage(sessionId, assistantMessage);

  return assistantMessage;
};
