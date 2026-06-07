import { Router } from 'express';
import { clearAuthCookie, setAuthCookie, type AuthUser } from '../../middleware/auth.js';
import { AuthServiceError, loginUser, registerUser, type SafeUser } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const user = await registerUser({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? '')
    });
    setAuthCookie(res, toAuthUser(user));
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const user = await loginUser({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? '')
    });
    setAuthCookie(res, toAuthUser(user));
    res.json({ user });
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

function toAuthUser(user: SafeUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
}
