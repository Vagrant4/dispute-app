import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';

export const authCookieName = 'claimproof_session';

export interface AuthUser {
  id: string;
  email: string;
  role: 'WORKER' | 'ADMIN_PLACEHOLDER';
}

interface AuthTokenPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresIn
    }
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    if (!payload.sub || !payload.email || !payload.role) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export function getAuthUserFromRequest(req: Request): AuthUser | null {
  const token = req.cookies?.[authCookieName];
  if (typeof token !== 'string' || token.length === 0) return null;
  return verifyAuthToken(token);
}

export function setAuthCookie(res: Response, user: AuthUser): void {
  res.cookie(authCookieName, signAuthToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  });
}
