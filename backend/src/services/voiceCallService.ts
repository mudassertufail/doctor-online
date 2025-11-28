import { Readable } from "stream";
import { STTProvider, TranscriptResult } from "./stt/STTProvider";
import { TTSProvider } from "./tts/TTSProvider";
import { AssemblyAIProvider } from "./stt/AssemblyAIProvider";
import { AWSPollyProvider } from "./tts/AWSPollyProvider";
import { config } from "../config";
import { appendMessage, getSession } from "../store/sessionStore";
import { ChatMessage } from "../types";
import { Ollama } from "ollama";
import { SYSTEM_PROMPT } from "../constants";

export interface VoiceCallSession {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  inactivityTimer?: NodeJS.Timeout;
  maxDurationTimer?: NodeJS.Timeout;
  pendingTranscript?: string;
  transcriptTimer?: NodeJS.Timeout;
  onAudioOut?: (audioChunk: Buffer) => void;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onAIResponse?: (text: string) => void;
  onCallEnd?: (reason: string) => void;
}

export class VoiceCallService {
  private activeCalls: Map<string, VoiceCallSession> = new Map();
  private ollamaClient: Ollama;

  constructor() {
    this.ollamaClient = new Ollama({
      host: config.ollamaHost,
    });
  }

  /**
   * Start a new voice call session
   */
  startCall(
    sessionId: string,
    callbacks: {
      onAudioOut: (audioChunk: Buffer) => void;
      onTranscriptUpdate: (transcript: string, isFinal: boolean) => void;
      onAIResponse?: (text: string) => void;
      onCallEnd: (reason: string) => void;
    }
  ): void {
    console.log("Call Started for session:", sessionId);

    if (this.activeCalls.has(sessionId)) {
      console.warn(
        "Call already active for session:",
        sessionId,
        "- ignoring duplicate request"
      );
      return; // Just return instead of throwing error
    }

    const session = getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    console.log("Session found:", session.name);

    // Initialize STT provider
    const sttProvider = new AssemblyAIProvider({
      apiKey: config.assemblyAIApiKey,
    });

    // Initialize TTS provider
    const ttsProvider = new AWSPollyProvider({
      region: config.awsPollyRegion,
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
      voiceId: config.awsPollyVoiceId,
    });

    const callSession: VoiceCallSession = {
      sessionId,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      sttProvider,
      ttsProvider,
      ...callbacks,
    };

    this.activeCalls.set(sessionId, callSession);

    // Start STT stream
    sttProvider.startStream(
      (result: TranscriptResult) => this.handleTranscript(sessionId, result),
      (error: Error) => this.handleSTTError(sessionId, error)
    );

    // Set up timers
    this.setupTimers(sessionId);

    // Send initial greeting
    this.sendGreeting(sessionId);

    console.log(`Voice call started for session ${sessionId}`);
  }

  /**
   * Process incoming audio from the user
   */
  processAudio(sessionId: string, audioChunk: Buffer): void {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) {
      throw new Error("No active call for this session");
    }
    // Update activity timestamp
    callSession.lastActivityTime = Date.now();
    this.resetInactivityTimer(sessionId);

    // Send audio to STT
    callSession.sttProvider.sendAudio(audioChunk);
  }

  /**
   * End a voice call
   */
  async endCall(
    sessionId: string,
    reason: string = "user_hangup"
  ): Promise<void> {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) {
      return;
    }

    // Clear timers
    if (callSession.inactivityTimer) {
      clearTimeout(callSession.inactivityTimer);
    }
    if (callSession.maxDurationTimer) {
      clearTimeout(callSession.maxDurationTimer);
    }
    if (callSession.transcriptTimer) {
      clearTimeout(callSession.transcriptTimer);
      console.log("🧹 Cleared pending transcript timer on call end");
    }
    
    // Clear pending transcript
    delete callSession.pendingTranscript;
    delete callSession.transcriptTimer;

    // Stop STT
    await callSession.sttProvider.stopStream();

    // Notify frontend
    if (callSession.onCallEnd) {
      callSession.onCallEnd(reason);
    }

    this.activeCalls.delete(sessionId);
    console.log(`Voice call ended for session ${sessionId}, reason: ${reason}`);
  }

  /**
   * Handle transcript from STT
   */
  private async handleTranscript(
    sessionId: string,
    result: TranscriptResult
  ): Promise<void> {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) return;

    // Log transcription results
    if (result.isFinal) {
      console.log("🎤 [FINAL TRANSCRIPT]:", result.text);
    } else {
      console.log("🎤 [PARTIAL TRANSCRIPT]:", result.text);
    }

    // Notify frontend of transcript update
    if (callSession.onTranscriptUpdate) {
      callSession.onTranscriptUpdate(result.text, result.isFinal);
    }

    // Only process final transcripts
    if (!result.isFinal) return;

    // Store the pending transcript
    callSession.pendingTranscript = result.text;

    // Clear any existing timer
    if (callSession.transcriptTimer) {
      clearTimeout(callSession.transcriptTimer);
      console.log("⏱️ Resetting AI response timer (user still speaking)");
    }

    // Start new timer with configurable delay
    callSession.transcriptTimer = setTimeout(async () => {
      const finalText = callSession.pendingTranscript;
      if (!finalText) return;

      console.log(`⏰ Processing transcript after ${config.aiResponseDelay}ms delay:`, finalText);

      const userMessage: ChatMessage = {
        role: "user",
        content: finalText,
        timestamp: Date.now(),
      };

      // Append to session history
      appendMessage(sessionId, userMessage);

      // Clear pending transcript
      delete callSession.pendingTranscript;
      delete callSession.transcriptTimer;

      // Get AI response
      await this.processAIResponse(sessionId, finalText);
    }, config.aiResponseDelay);
  }

  /**
   * Process AI response and convert to speech
   */
  private async processAIResponse(
    sessionId: string,
    userText: string
  ): Promise<void> {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) return;

    const session = getSession(sessionId);
    if (!session) return;

    try {
      // Build conversation for Llama
      const conversation = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...session.history
          .filter((message) => message.role !== "system")
          .map(({ role, content }) => ({ role, content })),
      ];

      // Get response from Llama
      const response = await this.ollamaClient.chat({
        model: config.ollamaModel,
        messages: conversation,
      });

      const aiText = response.message?.content?.trim();
      if (!aiText) {
        throw new Error("Empty response from AI");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: aiText,
        timestamp: Date.now(),
      };

      // Append to history
      appendMessage(sessionId, assistantMessage);

      // Notify frontend of AI response text
      if (callSession.onAIResponse) {
        callSession.onAIResponse(aiText);
      }

      // Convert to speech and send
      await this.synthesizeAndSend(sessionId, aiText);
    } catch (error) {
      console.error("Error processing AI response:", error);
      await this.endCall(sessionId, "ai_error");
    }
  }

  /**
   * Synthesize text to speech and send to user
   */
  private async synthesizeAndSend(
    sessionId: string,
    text: string
  ): Promise<void> {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession || !callSession.onAudioOut) return;

    try {
      const audioStream: Readable =
        await callSession.ttsProvider.synthesizeStream(text);

      // Stream audio chunks to the client
      audioStream.on("data", (chunk: Buffer) => {
        if (callSession.onAudioOut) {
          callSession.onAudioOut(chunk);
        }
      });

      audioStream.on("error", (error) => {
        console.error("TTS stream error:", error);
      });
    } catch (error) {
      console.error("Error synthesizing speech:", error);
    }
  }

  /**
   * Send initial greeting when call starts
   */
  private async sendGreeting(sessionId: string): Promise<void> {
    const greetingText =
      "Hello, I am Doctor Online, an experienced triage doctor. How may I help you today?";

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: greetingText,
      timestamp: Date.now(),
    };

    appendMessage(sessionId, assistantMessage);

    // Notify frontend of greeting text
    const callSession = this.activeCalls.get(sessionId);
    if (callSession?.onAIResponse) {
      callSession.onAIResponse(greetingText);
    }

    await this.synthesizeAndSend(sessionId, greetingText);
  }

  /**
   * Setup inactivity and max duration timers
   */
  private setupTimers(sessionId: string): void {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) return;

    // Inactivity timer
    callSession.inactivityTimer = setTimeout(() => {
      this.endCall(sessionId, "inactivity_timeout");
    }, config.callInactivityTimeout);

    // Max duration timer
    callSession.maxDurationTimer = setTimeout(() => {
      this.endCall(sessionId, "max_duration_exceeded");
    }, config.callMaxDuration);
  }

  /**
   * Reset inactivity timer on user activity
   */
  private resetInactivityTimer(sessionId: string): void {
    const callSession = this.activeCalls.get(sessionId);
    if (!callSession) return;

    if (callSession.inactivityTimer) {
      clearTimeout(callSession.inactivityTimer);
    }

    callSession.inactivityTimer = setTimeout(() => {
      this.endCall(sessionId, "inactivity_timeout");
    }, config.callInactivityTimeout);
  }

  /**
   * Handle STT errors
   */
  private handleSTTError(sessionId: string, error: Error): void {
    console.error(`STT error for session ${sessionId}:`, error);
    this.endCall(sessionId, "stt_error");
  }

  /**
   * Check if a call is active
   */
  isCallActive(sessionId: string): boolean {
    return this.activeCalls.has(sessionId);
  }
}

// Singleton instance
export const voiceCallService = new VoiceCallService();
