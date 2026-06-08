import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Router } from 'express';
import { env } from './config/env.js';
import { authErrorStatus, authRouter } from './modules/auth/auth.routes.js';
import { companyRouter } from './modules/companies/company.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { projectRouter } from './modules/projects/project.routes.js';
import { timeRouter } from './modules/time/time.routes.js';

interface CreateAppOptions {
  testRouter?: Router;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

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
  app.use('/profile', profileRouter);
  app.use('/companies', companyRouter);
  app.use('/projects', projectRouter);
  app.use('/time-entries', timeRouter);

  if (options.testRouter) {
    app.use('/test', options.testRouter);
  }

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const statusCode = authErrorStatus(error) ?? 500;
    const message = error instanceof Error ? error.message : 'Internal server error';

    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : message
    });
  };

  app.use(errorHandler);

  return app;
}

export const app = createApp();
