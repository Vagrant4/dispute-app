import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserStatus, type User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { isEmailDeliveryConfigured, sendVerificationEmail } from '../email/email.service.js';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export type SafeUser = Omit<User, 'passwordHash'>;

export interface RegistrationResult {
  user: SafeUser;
  verificationRequired: true;
  devVerificationCode?: string;
  devVerificationToken?: string;
  message: string;
}

export async function registerUser(input: { email: string; password: string }): Promise<RegistrationResult> {
  const email = normalizeEmail(input.email);
  validateCredentials(email, input.password);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    if (existingUser.status !== UserStatus.PENDING_EMAIL_VERIFICATION && existingUser.emailVerifiedAt) {
      throw new AuthServiceError('Email is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash }
    });
    const verification = await createEmailVerification(user.id);
    const emailSent = await trySendVerificationEmail({
      to: user.email,
      code: verification.code,
      token: verification.token
    });

    ensureVerificationEmailWasSent(emailSent);

    return buildRegistrationResult(
      user,
      verification,
      emailSent,
      'A new verification code was sent to your email.'
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'WORKER',
      status: 'PENDING_EMAIL_VERIFICATION',
      appSetting: {
        create: {}
      }
    }
  });

  const verification = await createEmailVerification(user.id);
  const emailSent = await trySendVerificationEmail({
    to: user.email,
    code: verification.code,
    token: verification.token
  });

  ensureVerificationEmailWasSent(emailSent);

  return buildRegistrationResult(
    user,
    verification,
    emailSent,
    isEmailDeliveryConfigured()
      ? 'Check your email to verify your account before logging in.'
      : 'Email sending is not configured. Use the dev verification code to verify this account.'
  );
}

function buildRegistrationResult(
  user: User,
  verification: { token: string; code: string },
  emailSent: boolean,
  message: string
): RegistrationResult {
  return {
    user: toSafeUser(user),
    verificationRequired: true,
    ...(env.nodeEnv === 'production' && isEmailDeliveryConfigured() && emailSent
      ? {}
      : {
          devVerificationCode: verification.code,
          devVerificationToken: verification.token
        }),
    message
  };
}

function ensureVerificationEmailWasSent(emailSent: boolean): void {
  if (env.nodeEnv === 'production' && isEmailDeliveryConfigured() && !emailSent) {
    throw new AuthServiceError('Unable to send verification email. Please check the email address and try again.', 502);
  }
}

async function trySendVerificationEmail(input: {
  to: string;
  code: string;
  token: string;
}): Promise<boolean> {
  try {
    if (!isEmailDeliveryConfigured()) {
      return false;
    }

    await Promise.race([
      sendVerificationEmail(input),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Verification email delivery timed out')), 10000);
      })
    ]);
    return true;
  } catch (error) {
    console.error('Verification email delivery failed', error);
    return false;
  }
}

export async function loginUser(input: { email: string; password: string }): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  if (user.status === UserStatus.PENDING_EMAIL_VERIFICATION || !user.emailVerifiedAt) {
    throw new AuthServiceError('Verify your email before logging in', 403);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() }
  });

  return toSafeUser(user);
}

export async function verifyEmail(input: {
  email?: string;
  code?: string;
  token?: string;
}): Promise<SafeUser> {
  const email = input.email ? normalizeEmail(input.email) : '';
  const code = input.code?.trim() ?? '';
  const token = input.token?.trim() ?? '';

  if (!token && (!email || !code)) {
    throw new AuthServiceError('Verification token or email and code are required', 400);
  }

  const verificationToken = token
    ? await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationValue(token) },
        include: { user: true }
      })
    : await findVerificationByEmailAndCode(email, code);

  if (!verificationToken || verificationToken.consumedAt || verificationToken.expiresAt < new Date()) {
    throw new AuthServiceError('Verification code is invalid or expired', 400);
  }

  const verifiedUser = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { consumedAt: new Date() }
    });

    return tx.user.update({
      where: { id: verificationToken.userId },
      data: {
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastSeenAt: new Date()
      }
    });
  });

  return toSafeUser(verifiedUser);
}

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCredentials(email: string, password: string): void {
  if (!isValidEmail(email)) {
    throw new AuthServiceError('A valid email is required', 400);
  }

  if (password.length < 8) {
    throw new AuthServiceError('Password must be at least 8 characters', 400);
  }
}

async function createEmailVerification(userId: string): Promise<{ token: string; code: string }> {
  const token = randomBytes(32).toString('hex');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationValue(token),
      codeHash: await bcrypt.hash(code, 12),
      expiresAt
    }
  });

  return { token, code };
}

async function findVerificationByEmailAndCode(email: string, code: string) {
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return null;
  }

  const tokens = await prisma.emailVerificationToken.findMany({
    where: {
      consumedAt: null,
      expiresAt: { gt: new Date() },
      user: { email }
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const token of tokens) {
    if (await bcrypt.compare(code, token.codeHash)) {
      return token;
    }
  }

  return null;
}

function hashVerificationValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
