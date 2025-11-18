import { Router } from 'express';
import { createSession, getSession } from '../store/sessionStore';

export const sessionRouter = Router();

sessionRouter.post('/', (req, res) => {
  const { name, email } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const session = createSession(name.trim(), email?.trim());
  return res.status(201).json({ session });
});

sessionRouter.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({ session });
});

