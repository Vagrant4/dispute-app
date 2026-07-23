import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { clearAuthCookie, setAuthCookie, type AuthUser } from '../../middleware/auth.js';
import {
  AuthServiceError,
  loginUser,
  registerUser,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  type SafeUser
} from './auth.service.js';

export const authRouter = Router();

const accountActionLimiter = createAuthLimiter(5, 'Too many account requests. Please wait 15 minutes and try again.');
const credentialLimiter = createAuthLimiter(10, 'Too many attempts. Please wait 15 minutes and try again.');

authRouter.post('/register', accountActionLimiter, async (req, res, next) => {
  try {
    const result = await registerUser({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? ''),
      fullName: String(req.body?.fullName ?? ''),
      phone: String(req.body?.phone ?? '')
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/resend-verification', accountActionLimiter, async (req, res, next) => {
  try {
    res.json(
      await resendVerificationEmail({
        email: String(req.body?.email ?? '')
      })
    );
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-email', credentialLimiter, async (req, res, next) => {
  try {
    const user = await verifyEmail({
      email: req.body?.email ? String(req.body.email) : undefined,
      code: req.body?.code ? String(req.body.code) : undefined,
      token: req.body?.token ? String(req.body.token) : undefined
    });
    setAuthCookie(res, toAuthUser(user));
    const profile = await prisma.workerProfile.findUnique({ where: { userId: user.id } });
    res.json({ user, profile, message: 'Email verified. You are logged in.' });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/verify-email', credentialLimiter, async (req, res) => {
  try {
    const user = await verifyEmail({
      token: req.query?.token ? String(req.query.token) : undefined
    });
    setAuthCookie(res, toAuthUser(user));
    res.type('html').send(renderVerificationPage('Email verified', 'Your Dispute account is verified. You can return to the mobile app and log in.'));
  } catch (error) {
    const statusCode = authErrorStatus(error) ?? 400;
    const message = error instanceof Error ? error.message : 'Verification failed.';
    res
      .status(statusCode)
      .type('html')
      .send(renderVerificationPage('Verification failed', message));
  }
});

authRouter.post('/login', credentialLimiter, async (req, res, next) => {
  try {
    const user = await loginUser({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? '')
    });
    setAuthCookie(res, toAuthUser(user));
    const profile = await prisma.workerProfile.findUnique({ where: { userId: user.id } });
    res.json({ user, profile });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/forgot-password', accountActionLimiter, async (req, res, next) => {
  try {
    const result = await requestPasswordReset({
      email: String(req.body?.email ?? '')
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', credentialLimiter, async (req, res, next) => {
  try {
    await resetPassword({
      email: String(req.body?.email ?? ''),
      code: String(req.body?.code ?? ''),
      password: String(req.body?.password ?? '')
    });
    res.json({ message: 'Password reset successful. You can login with your new password.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).send();
});

export function authErrorStatus(error: unknown): number | null {
  if (error instanceof AuthServiceError) return error.statusCode;
  return null;
}

export function createAuthLimiter(limit: number, error: string, skipInTest = true) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => skipInTest && env.nodeEnv === 'test',
    message: { error }
  });
}

function toAuthUser(user: SafeUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
}

function renderVerificationPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Dispute</title>
    <style>
      body { margin: 0; background: #050805; color: #f5fff0; font-family: Arial, sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      section { max-width: 520px; border: 1px solid #263820; border-radius: 28px; padding: 32px; background: #0c120d; }
      .brand { color: #9cff16; font-weight: 800; letter-spacing: .02em; margin-bottom: 16px; }
      h1 { font-size: 34px; line-height: 1.05; margin: 0 0 16px; }
      p { color: #b8c2b3; font-size: 18px; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <div class="brand">dispute</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
