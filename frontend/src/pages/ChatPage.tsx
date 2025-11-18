import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SendIcon from "@mui/icons-material/Send";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import type { ChatMessage } from "../types/chat";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: isUser ? "primary.main" : "grey.100",
          color: isUser ? "primary.contrastText" : "text.primary",
          borderRadius: 3,
          maxWidth: "80%",
          boxShadow: 1,
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
          {message.content}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{ mt: 0.5, color: "text.secondary", fontWeight: 500 }}
      >
        {isUser ? "You" : "Doctor AI"} · {formatTime(message.timestamp)}
      </Typography>
    </Box>
  );
};

export const ChatPage = () => {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{
    content: string;
    timestamp: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  const history = useMemo(() => session?.history ?? [], [session]);
  const visibleHistory = useMemo(
    () => history.filter((msg) => msg.role !== "system"),
    [history]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleHistory, sendingMessage, streamingMessage]);

  const upsertSessionHistory = (newHistory: ChatMessage[]) => {
    setSession((current) =>
      current
        ? {
            ...current,
            history: newHistory,
          }
        : current
    );
  };

  const handleSendMessage = async () => {
    if (!session || !message.trim() || sendingMessage) return;
    setError(null);
    const outgoing = message.trim();
    setMessage("");
    setSendingMessage(true);
    setStreamingMessage({ content: "", timestamp: Date.now() });
    const optimisticMessage: ChatMessage = {
      role: "user",
      content: outgoing,
      timestamp: Date.now(),
    };

    setSession((current) =>
      current
        ? {
            ...current,
            history: [...current.history, optimisticMessage],
          }
        : current
    );

    const processStream = async (response: Response) => {
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Unable to send message.");
      }
      if (!response.body) {
        throw new Error("Streaming not supported in this browser.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const parseBuffer = () => {
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (rawEvent.startsWith("data:")) {
            const payloadText = rawEvent.replace(/^data:\s*/, "");
            if (payloadText) {
              const payload = JSON.parse(payloadText);
              if (payload.type === "chunk") {
                const chunk = payload.content ?? "";
                setStreamingMessage((current) =>
                  current
                    ? {
                        ...current,
                        content: current.content + chunk,
                      }
                    : current
                );
              } else if (payload.type === "done") {
                upsertSessionHistory(payload.history as ChatMessage[]);
                setStreamingMessage(null);
              } else if (payload.type === "error") {
                throw new Error(payload.error || "Unable to send message.");
              }
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          parseBuffer();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        parseBuffer();
      }
    };

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ sessionId: session.id, message: outgoing }),
      });
      await processStream(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
      try {
        const res = await fetch(`${API_BASE}/api/session/${session?.id}`);
        const data = await res.json();
        if (res.ok) {
          upsertSessionHistory(data.session.history as ChatMessage[]);
        }
      } catch {
        // swallow
      }
      setStreamingMessage(null);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReset = () => {
    setSession(null);
    navigate("/");
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box className="chat-shell">
      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          display: "flex",
          height: "100%",
          py: { xs: 2, md: 4 },
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={4}
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            width: "clamp(360px, 100%, 1360px)",
            overflow: "hidden",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Chat with Doctor Online
              </Typography>
              <Typography color="text.secondary">{session?.name}</Typography>
            </Box>
            <IconButton onClick={handleReset} sx={{ marginLeft: "auto" }}>
              <RestartAltIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            ref={scrollRef}
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: 1,
              pb: 2,
            }}
          >
            <Stack spacing={2}>
              {!visibleHistory.length && (
                <Typography color="text.secondary" align="center">
                  Describe your symptoms or concerns to begin.
                </Typography>
              )}
              {visibleHistory.map((msg, index) => (
                <MessageBubble
                  key={`${msg.timestamp}-${index}`}
                  message={msg}
                />
              ))}
              {streamingMessage && (
                <MessageBubble
                  key={`streaming-${streamingMessage.timestamp}`}
                  message={{
                    role: "assistant",
                    content:
                      streamingMessage.content || "Doctor AI is thinking...",
                    timestamp: streamingMessage.timestamp,
                  }}
                />
              )}
              {sendingMessage && !streamingMessage && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Doctor AI is thinking...
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              pt: 1,
              position: "sticky",
              bottom: 0,
              bgcolor: "background.paper",
            }}
          >
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                placeholder="Describe your symptoms, test results, or concerns…"
                value={message}
                disabled={!session}
                onChange={(event) => setMessage(event.target.value)}
                multiline
                minRows={2}
                onKeyDown={handleComposerKeyDown}
              />
              <Button
                variant="contained"
                endIcon={<SendIcon />}
                onClick={handleSendMessage}
                disabled={!session || !message.trim() || sendingMessage}
              >
                Send
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};
