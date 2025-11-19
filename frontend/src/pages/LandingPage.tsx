import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import type { Session } from "../types/chat";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const LandingPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"chat" | "call">("chat");
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useSession();

  const isValidEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  const showEmailError = emailTouched && (!email.trim() || !isValidEmail);

  const handleStart = async () => {
    if (!name.trim()) {
      setError("Please enter your name to continue.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email to continue.");
      return;
    }
    if (!isValidEmail) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to start session");
      }
      setSession(data.session as Session);
      // Navigate based on mode
      if (mode === "call") {
        navigate("/call");
      } else {
        navigate("/chat");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="app-shell">
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack spacing={4} sx={{ maxWidth: 520, mx: "auto" }}>
          <Box textAlign="center">
            <Typography variant="h3" fontWeight={700}>
              Doctor Online 24/7
            </Typography>
            <Typography variant="h6" color="text.secondary" mt={1}>
              Instant AI-powered triage, lifestyle tips, and specialist
              guidance.
            </Typography>
          </Box>
          <Card sx={{ p: 1 }}>
            <CardContent>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar>
                    <ChatBubbleOutlineIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Start a consultation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tell us who you are and choose how you want to connect.
                    </Typography>
                  </Box>
                </Stack>

                <TextField
                  label="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  fullWidth
                  onBlur={() => setEmailTouched(true)}
                  error={showEmailError}
                  helperText={
                    showEmailError
                      ? "Enter a valid email address (e.g., user@example.com)"
                      : undefined
                  }
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Choose assistance mode
                  </Typography>
                  <ToggleButtonGroup
                    value={mode}
                    exclusive
                    onChange={(_event, value) => value && setMode(value)}
                    fullWidth
                  >
                    <ToggleButton value="chat">
                      <ChatBubbleOutlineIcon fontSize="small" sx={{ mr: 1 }} />
                      Chat
                    </ToggleButton>
                    <ToggleButton value="call">
                      <PhoneIcon fontSize="small" sx={{ mr: 1 }} />
                      Call
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" mt={1}>
                    Choose between text chat or voice call consultation.
                  </Typography>
                </Box>

                {error && <Alert severity="error">{error}</Alert>}

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleStart}
                  disabled={loading || showEmailError}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Start session"
                  )}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
};
