import { AssemblyAI } from "assemblyai";
import { STTProvider, TranscriptResult } from "./STTProvider";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

export interface AssemblyAIConfig {
  apiKey: string;
  sampleRate?: number;
}

export class AssemblyAIProvider implements STTProvider {
  private transcriber: any = null;
  private client: AssemblyAI;
  private config: Required<AssemblyAIConfig>;
  private active: boolean = false;
  private debugAudioStream: fs.WriteStream | null = null;
  private debugAudioFilePath: string = "";
  private audioChunkCount: number = 0;

  constructor(config: AssemblyAIConfig) {
    this.config = {
      sampleRate: 16000,
      ...config,
    };
    this.client = new AssemblyAI({
      apiKey: this.config.apiKey,
    });

    // Create debug audio file
    const debugDir = path.join(process.cwd(), "debug_audio");
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.debugAudioFilePath = path.join(debugDir, `audio_${timestamp}.raw`);
    this.debugAudioStream = fs.createWriteStream(this.debugAudioFilePath);
    console.log(`🎙️ Saving audio chunks to: ${this.debugAudioFilePath}`);
  }

  async startStream(
    onTranscript: (result: TranscriptResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (this.active) {
      throw new Error("Stream already active");
    }

    try {
      // Create streaming transcriber with new API
      this.transcriber = this.client.streaming.transcriber({
        sampleRate: this.config.sampleRate,
      });

      this.transcriber.on("open", ({ sessionId }: any) => {
        console.log(
          `✅ AssemblyAI connection opened - Session ID: ${sessionId}`
        );
        this.active = true;
      });

      // Listen for partial transcripts
      this.transcriber.on("transcript", (transcript: any) => {
        console.log(
          "🔍 [AssemblyAI RAW TRANSCRIPT EVENT]:",
          JSON.stringify(transcript, null, 2)
        );
        if (transcript.text) {
          console.log("📝 [AssemblyAI PARTIAL TEXT]:", transcript.text);
          onTranscript({
            text: transcript.text,
            isFinal: false,
            timestamp: Date.now(),
          });
        } else {
          console.log(
            "⚠️ [AssemblyAI] Transcript event received but no text property"
          );
        }
      });

      // Listen for final transcripts (turns)
      this.transcriber.on("turn", (turn: any) => {
        console.log(
          "🔍 [AssemblyAI RAW TURN EVENT]:",
          JSON.stringify(turn, null, 2)
        );
        if (turn.transcript) {
          console.log("✅ [AssemblyAI FINAL TEXT]:", turn.transcript);
          onTranscript({
            text: turn.transcript,
            isFinal: true,
            timestamp: Date.now(),
          });
        } else {
          console.log(
            "⚠️ [AssemblyAI] Turn event received but no transcript property"
          );
        }
      });

      this.transcriber.on("error", (error: any) => {
        console.error("❌ AssemblyAI error:", error);
        onError(new Error(error.message || "STT error"));
      });

      this.transcriber.on("close", (code: number, reason: string) => {
        console.log(`AssemblyAI connection closed: ${code} - ${reason}`);
        this.active = false;
      });

      // Connect to AssemblyAI
      await this.transcriber.connect();
      console.log("🔗 AssemblyAI transcriber connected");
    } catch (error) {
      console.error("❌ Failed to start AssemblyAI stream:", error);
      throw error;
    }
  }

  sendAudio(audioChunk: Buffer): void {
    // Save audio chunk to debug file
    if (this.debugAudioStream) {
      this.debugAudioStream.write(audioChunk);
      this.audioChunkCount++;
      if (this.audioChunkCount % 100 === 0) {
        console.log(
          `📊 Received ${this.audioChunkCount} audio chunks (${audioChunk.length} bytes each)`
        );
      }
    }

    if (!this.transcriber) {
      console.warn("STT transcriber not initialized yet, skipping audio chunk");
      return;
    }
    if (!this.active) {
      console.warn("STT stream not active yet, skipping audio chunk");
      return;
    }

    // Log first few chunks for debugging
    if (this.audioChunkCount <= 5) {
      console.log(
        `🎤 Sending audio chunk #${this.audioChunkCount}: ${audioChunk.length} bytes to AssemblyAI`
      );
      // Log first 20 bytes to verify it's not silent (all zeros)
      const preview = Array.from(audioChunk.slice(0, 20))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      console.log(`   Audio data preview: ${preview}...`);

      // Check if audio is silent (all zeros or near zero)
      const sum = audioChunk.reduce((acc, val) => acc + Math.abs(val), 0);
      const avg = sum / audioChunk.length;
      console.log(
        `   Audio level check - Average: ${avg.toFixed(
          2
        )} (should be > 1 if audio present)`
      );
    }

    // Send audio buffer directly to the new API
    try {
      this.transcriber.sendAudio(audioChunk);
    } catch (error) {
      console.error("❌ Error sending audio to AssemblyAI:", error);
      throw error;
    }
  }

  async stopStream(): Promise<void> {
    if (this.transcriber) {
      await this.transcriber.close();
      this.transcriber = null;
      this.active = false;
    }

    // Close debug audio file and convert to WAV
    if (this.debugAudioStream) {
      this.debugAudioStream.end();
      console.log(
        `✅ Audio debug file closed. Total chunks: ${this.audioChunkCount}`
      );
      this.debugAudioStream = null;

      // Convert RAW to WAV for easy playback
      this.convertRawToWav(this.debugAudioFilePath);
    }
  }

  private convertRawToWav(rawFilePath: string): void {
    const wavFilePath = rawFilePath.replace(".raw", ".wav");
    const command = `ffmpeg -f s16le -ar 16000 -ac 1 -i "${rawFilePath}" "${wavFilePath}" -y`;

    console.log(`🔄 Converting audio to WAV format...`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `⚠️ Could not convert to WAV (ffmpeg not installed?):`,
          error.message
        );
        console.log(`💡 You can manually convert using: ${command}`);
        return;
      }
      console.log(`✅ Audio converted to WAV: ${wavFilePath}`);
      console.log(`🎵 Play with: afplay "${wavFilePath}"`);
    });
  }

  isActive(): boolean {
    return this.active;
  }
}
