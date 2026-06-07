import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { env } from './config/env.js';
import { requireUser } from './middleware/requireUser.js';
import { authErrorStatus, authRouter } from './modules/auth/auth.routes.js';

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

if (env.nodeEnv === 'test') {
  app.get('/test/protected', requireUser, (req, res) => {
    res.json({ user: req.user });
  });
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = authErrorStatus(error) ?? 500;
  const message = error instanceof Error ? error.message : 'Internal server error';

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : message
  });
};

app.use(errorHandler);
