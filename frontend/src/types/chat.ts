export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
  timestamp: number;
};

export type Session = {
  id: string;
  name: string;
  email?: string;
  history: ChatMessage[];
};

