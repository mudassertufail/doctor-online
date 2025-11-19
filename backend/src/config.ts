import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
  ollamaHost: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  
  // Voice call configuration
  assemblyAIApiKey: process.env.ASSEMBLYAI_API_KEY || "",
  awsPollyRegion: process.env.AWS_POLLY_REGION || "us-east-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  awsPollyVoiceId: process.env.AWS_POLLY_VOICE_ID || "Joanna",
  
  // Call timeouts (in milliseconds)
  callInactivityTimeout: Number(process.env.CALL_INACTIVITY_TIMEOUT_MS) || 60000,
  callMaxDuration: Number(process.env.CALL_MAX_DURATION_MS) || 300000,
};
