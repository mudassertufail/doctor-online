export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface STTProvider {
  /**
   * Start streaming audio for transcription
   * @param onTranscript Callback fired when transcript is available
   * @param onError Callback fired on error
   */
  startStream(
    onTranscript: (result: TranscriptResult) => void,
    onError: (error: Error) => void
  ): void | Promise<void>;

  /**
   * Send audio chunk to the STT service
   * @param audioChunk Raw audio data (PCM 16-bit, 16kHz mono recommended)
   */
  sendAudio(audioChunk: Buffer): void;

  /**
   * Stop the transcription stream and clean up
   */
  stopStream(): Promise<void>;

  /**
   * Check if the stream is currently active
   */
  isActive(): boolean;
}

