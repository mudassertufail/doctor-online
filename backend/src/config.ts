import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
  ollamaHost: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
};
