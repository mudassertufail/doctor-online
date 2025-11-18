import { v4 as uuid } from 'uuid';
import { DISCLAIMER_MESSAGE, SYSTEM_PROMPT } from '../constants';
import type { ChatMessage, PatientSession } from '../types';

const sessions = new Map<string, PatientSession>();

const fallbackEmail = 'not-provided@doctor-online.local';

export const createSession = (
  name: string,
  email?: string,
): PatientSession => {
  const id = uuid();
  const now = Date.now();
  const session: PatientSession = {
    id,
    name,
    email: email || fallbackEmail,
    history: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
        timestamp: now,
      },
      {
        role: 'assistant',
        content: DISCLAIMER_MESSAGE,
        timestamp: now,
      },
    ],
    createdAt: Date.now(),
  };

  sessions.set(id, session);
  return session;
};

export const getSession = (sessionId: string): PatientSession | undefined =>
  sessions.get(sessionId);

export const appendMessage = (
  sessionId: string,
  message: ChatMessage,
): PatientSession | undefined => {
  const session = sessions.get(sessionId);
  if (session) {
    session.history.push(message);
  }
  return session;
};

export const listSessions = (): PatientSession[] => Array.from(sessions.values());

