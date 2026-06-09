import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Router } from 'express';
import { env } from './config/env.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authErrorStatus, authRouter } from './modules/auth/auth.routes.js';
import { companyRouter } from './modules/companies/company.routes.js';
import { payRouter } from './modules/pay/pay.routes.js';
import { photoRouter } from './modules/photos/photo.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { projectRouter } from './modules/projects/project.routes.js';
import { reportRouter } from './modules/reports/report.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { subscriptionRouter } from './modules/subscription/subscription.routes.js';
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
  app.use('/photo-evidence', photoRouter);
  app.use('/pay-summaries', payRouter);
  app.use('/reports', reportRouter);
  app.use('/settings', settingsRouter);
  app.use('/subscription', subscriptionRouter);
  app.use('/admin', adminRouter);

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
