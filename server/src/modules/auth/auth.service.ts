import bcrypt from 'bcryptjs';
import { UserStatus, type User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export type SafeUser = Omit<User, 'passwordHash'>;

export async function registerUser(input: { email: string; password: string }): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  validateCredentials(email, input.password);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AuthServiceError('Email is already registered', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'WORKER',
      status: 'ACTIVE',
      appSetting: {
        create: {}
      }
    }
  });

  return toSafeUser(user);
}

export async function loginUser(input: { email: string; password: string }): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  return toSafeUser(user);
}

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateCredentials(email: string, password: string): void {
  if (!email || !email.includes('@')) {
    throw new AuthServiceError('A valid email is required', 400);
  }

  if (password.length < 8) {
    throw new AuthServiceError('Password must be at least 8 characters', 400);
  }
}
