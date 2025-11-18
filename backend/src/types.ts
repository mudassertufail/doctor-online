export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
}

export interface PatientSession {
  id: string;
  name: string;
  email?: string;
  history: ChatMessage[];
  createdAt: number;
}

