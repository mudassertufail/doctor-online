import { Readable } from "stream";

export interface TTSProvider {
  /**
   * Synthesize text to speech and return an audio stream
   * @param text Text to convert to speech
   * @returns Readable stream of audio data
   */
  synthesizeStream(text: string): Promise<Readable>;

  /**
   * Get the audio format information
   */
  getAudioFormat(): {
    sampleRate: number;
    channels: number;
    encoding: string;
  };
}

