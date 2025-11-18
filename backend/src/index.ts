import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config';
import { sessionRouter } from './routes/sessionRoutes';
import { chatRouter } from './routes/chatRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/session', sessionRouter);
app.use('/api/chat', chatRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});

