import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useVoiceCall } from "../hooks/useVoiceCall";

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const VoiceCallPage = () => {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  const { isConnected, isConnecting, transcripts, error, startCall, endCall } =
    useVoiceCall({
      sessionId: session?.id || "",
      onCallEnd: (reason) => {
        setCallEnded(true);
        setEndReason(reason);
      },
      onError: (err) => {
        console.error("Voice call error:", err);
      },
    });

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-start call on mount
  useEffect(() => {
    if (session && !isConnected && !isConnecting && !callEnded) {
      console.log("🎤 Auto-starting voice call...");
      startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]); // Only depend on session ID to prevent multiple calls

  const handleEndCall = () => {
    endCall();
    setCallEnded(true);
  };

  const handleReset = () => {
    setSession(null);
    navigate("/");
  };

  const getEndReasonMessage = (reason: string | null): string => {
    switch (reason) {
      case "inactivity_timeout":
        return "Call ended due to inactivity";
      case "max_duration_exceeded":
        return "Call ended: Maximum duration reached";
      case "user_hangup":
        return "Call ended";
      case "stt_error":
        return "Call ended: Speech recognition error";
      case "ai_error":
        return "Call ended: AI processing error";
      default:
        return "Call ended";
    }
  };

  return (
    <Box className="chat-shell">
      <Container
        maxWidth="lg"
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
            width: "clamp(320px, 100%, 1360px)",
            overflow: "hidden",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Voice Call with Doctor Online
              </Typography>
              <Typography color="text.secondary">{session?.name}</Typography>
            </Box>
            <IconButton onClick={handleReset} sx={{ marginLeft: "auto" }}>
              <RestartAltIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Call Status */}
          <Card
            sx={{
              mb: 2,
              bgcolor: isConnected ? "success.light" : "grey.100",
              textAlign: "center",
              py: 3,
            }}
          >
            <CardContent>
              {isConnecting && (
                <>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography variant="h6">Connecting...</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Requesting microphone access
                  </Typography>
                </>
              )}

              {isConnected && !callEnded && (
                <>
                  <MicIcon sx={{ fontSize: 48, mb: 1, color: "success.dark" }} />
                  <Typography variant="h6" fontWeight={600}>
                    Call Active
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                    {formatDuration(callDuration)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Speak clearly to describe your symptoms
                  </Typography>
                </>
              )}

              {callEnded && (
                <>
                  <Typography variant="h6" color="text.secondary">
                    {getEndReasonMessage(endReason)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Duration: {formatDuration(callDuration)}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>

          {/* Transcript Display */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: 2,
              py: 2,
              bgcolor: "grey.50",
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Live Transcript
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {transcripts.length === 0 && (
              <Typography color="text.secondary" align="center">
                {isConnected
                  ? "Listening... Start speaking to see transcript"
                  : "Transcript will appear here"}
              </Typography>
            )}

            <Stack spacing={1.5}>
              {transcripts.map((entry, index) => (
                <Paper
                  key={index}
                  elevation={1}
                  sx={{
                    p: 1.5,
                    bgcolor: entry.isFinal ? "white" : "grey.100",
                    borderLeft: entry.isFinal ? "4px solid" : "none",
                    borderColor: "primary.main",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontStyle: entry.isFinal ? "normal" : "italic",
                      color: entry.isFinal ? "text.primary" : "text.secondary",
                    }}
                  >
                    {entry.text}
                  </Typography>
                  {entry.isFinal && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>

          {/* Call Controls */}
          <Box sx={{ textAlign: "center" }}>
            {isConnected && !callEnded && (
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<CallEndIcon />}
                onClick={handleEndCall}
                sx={{ minWidth: 200 }}
              >
                End Call
              </Button>
            )}

            {callEnded && (
              <Button
                variant="contained"
                size="large"
                onClick={handleReset}
                sx={{ minWidth: 200 }}
              >
                Back to Home
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

