import { useCallback, useEffect, useRef, useState } from "react";

export interface TranscriptEntry {
  text: string;
  role: "user" | "assistant";
  timestamp: number;
}

export interface UseVoiceCallOptions {
  sessionId: string;
  onCallEnd?: (reason: string) => void;
  onError?: (error: string) => void;
}

export interface UseVoiceCallReturn {
  isConnected: boolean;
  isConnecting: boolean;
  transcripts: TranscriptEntry[];
  error: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// Debug logs
console.log("🔗 API_BASE:", API_BASE);
console.log("🔗 WS_BASE:", WS_BASE);

export const useVoiceCall = ({
  sessionId,
  onCallEnd,
  onError,
}: UseVoiceCallOptions): UseVoiceCallReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const startCall = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context for capturing mic input
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect WebSocket
      const wsUrl = `${WS_BASE}/api/call/ws`;
      console.log("🔗 Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("WebSocket connected");
        // Send start call message
        ws.send(
          JSON.stringify({
            type: "start_call",
            sessionId,
          })
        );
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          // Control message
          const message = JSON.parse(event.data);
          handleControlMessage(message);
        } else {
          // Audio data from server (TTS)
          handleIncomingAudio(event.data);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        const errorMsg = "WebSocket connection error";
        setError(errorMsg);
        onError?.(errorMsg);
        cleanup();
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        cleanup();
      };

      // Capture and send microphone audio
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32Array to Int16Array (PCM)
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsConnecting(false);
      setIsConnected(true);
    } catch (err) {
      console.error("Error starting call:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to start call";
      setError(errorMsg);
      onError?.(errorMsg);
      setIsConnecting(false);
      cleanup();
    }
  }, [sessionId, isConnected, isConnecting, onError]);

  const handleControlMessage = (message: any) => {
    switch (message.type) {
      case "start_call":
        if (message.payload?.success) {
          console.log("Call started successfully");
        }
        break;

      case "transcript_update":
        const { transcript, isFinal } = message.payload;
        
        setTranscripts((prev) => {
          // If it's a partial transcript, update the last user message
          if (!isFinal) {
            // Check if last message is from user
            if (prev.length > 0 && prev[prev.length - 1].role === "user") {
              // Update the last message
              const updated = [...prev];
              updated[updated.length - 1] = {
                text: transcript,
                role: "user",
                timestamp: Date.now(),
              };
              return updated;
            } else {
              // Create new user message
              return [
                ...prev,
                { text: transcript, role: "user", timestamp: Date.now() },
              ];
            }
          } else {
            // Final transcript - update or create
            if (prev.length > 0 && prev[prev.length - 1].role === "user") {
              // Update the last user message with final text
              const updated = [...prev];
              updated[updated.length - 1] = {
                text: transcript,
                role: "user",
                timestamp: Date.now(),
              };
              return updated;
            } else {
              // Create new user message (shouldn't happen, but handle it)
              return [
                ...prev,
                { text: transcript, role: "user", timestamp: Date.now() },
              ];
            }
          }
        });
        break;
      
      case "ai_response":
        const { text } = message.payload;
        setTranscripts((prev) => [
          ...prev,
          { text, role: "assistant", timestamp: Date.now() },
        ]);
        break;

      case "call_ended":
        const reason = message.payload?.reason || "unknown";
        console.log("Call ended:", reason);
        onCallEnd?.(reason);
        cleanup();
        break;

      case "error":
        const errorMsg = message.payload?.error || "Unknown error";
        setError(errorMsg);
        onError?.(errorMsg);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  };

  const handleIncomingAudio = async (audioData: ArrayBuffer) => {
    // Queue audio for playback
    audioQueueRef.current.push(audioData);
    if (!isPlayingRef.current) {
      playAudioQueue();
    }
  };

  const playAudioQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    try {
      const audioContext =
        audioContextRef.current || new AudioContext({ sampleRate: 16000 });
      if (!audioContextRef.current) {
        audioContextRef.current = audioContext;
      }

      // Convert PCM Int16 to Float32
      const pcmData = new Int16Array(audioData);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / (pcmData[i] < 0 ? 0x8000 : 0x7fff);
      }

      const audioBuffer = audioContext.createBuffer(1, floatData.length, 16000);
      audioBuffer.getChannelData(0).set(floatData);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        playAudioQueue();
      };

      source.start();
    } catch (err) {
      console.error("Error playing audio:", err);
      isPlayingRef.current = false;
    }
  };

  const endCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "end_call",
          sessionId,
        })
      );
    }
    cleanup();
  }, [sessionId]);

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    transcripts,
    error,
    startCall,
    endCall,
  };
};
