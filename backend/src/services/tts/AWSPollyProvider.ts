import {
  PollyClient,
  SynthesizeSpeechCommand,
  SynthesizeSpeechCommandInput,
} from "@aws-sdk/client-polly";
import { Readable } from "stream";
import { TTSProvider } from "./TTSProvider";

export interface AWSPollyConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  voiceId?: string;
  engine?: "standard" | "neural";
  languageCode?: string;
}

export class AWSPollyProvider implements TTSProvider {
  private client: PollyClient;
  private config: Required<AWSPollyConfig>;

  constructor(config: AWSPollyConfig) {
    this.config = {
      voiceId: "Joanna",
      engine: "neural",
      languageCode: "en-US",
      ...config,
    };

    this.client = new PollyClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async synthesizeStream(text: string): Promise<Readable> {
    const params: SynthesizeSpeechCommandInput = {
      Text: text,
      OutputFormat: "pcm",
      VoiceId: this.config.voiceId as any,
      Engine: this.config.engine,
      LanguageCode: this.config.languageCode as any,
      SampleRate: "16000",
    };

    try {
      const command = new SynthesizeSpeechCommand(params);
      const response = await this.client.send(command);

      if (!response.AudioStream) {
        throw new Error("No audio stream returned from Polly");
      }

      // Convert the SDK stream to a Node.js Readable stream
      return response.AudioStream as Readable;
    } catch (error) {
      console.error("AWS Polly TTS error:", error);
      throw new Error(
        `TTS synthesis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  getAudioFormat() {
    return {
      sampleRate: 16000,
      channels: 1,
      encoding: "pcm_s16le",
    };
  }
}
