import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, UserStatus, type User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { isEmailDeliveryConfigured, sendPasswordResetEmail, sendVerificationEmail } from '../email/email.service.js';
import { createTrialSubscriptionForUser } from '../subscription/subscription.service.js';
import {
  findEligibleReferrer,
  generateUniqueReferralCode,
  normalizePhoneForAbuseControl,
  normalizeReferralCode
} from '../referrals/referral.service.js';

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

export interface PasswordResetRequestResult {
  resetRequired: true;
  message: string;
  devResetCode?: string;
}

export type VerificationResendResult = Omit<RegistrationResult, 'user'> & { user?: SafeUser };

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  referralCode?: string;
}): Promise<RegistrationResult> {
  const email = normalizeEmail(input.email);
  validateCredentials(email, input.password);
  const profile = normalizeSignupProfile(input.fullName, input.phone);
  const requestedReferralCode = normalizeReferralCode(input.referralCode);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AuthServiceError(
      existingUser.status === UserStatus.PENDING_EMAIL_VERIFICATION
        ? 'Account registration is pending email verification. Use Resend code.'
        : 'Email is already registered',
      409
    );
  }

  const existingPhone = requestedReferralCode
    ? await prisma.workerProfile.findFirst({
        where: {
          normalizedPhone: profile.normalizedPhone,
          user: { status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } }
        },
        select: { id: true }
      })
    : false;
  if (existingPhone) {
    throw new AuthServiceError('Mobile number is already registered', 409);
  }

  const referrer = requestedReferralCode
    ? await findEligibleReferrer(requestedReferralCode)
    : null;
  if (requestedReferralCode && !referrer) {
    throw new AuthServiceError('Referral code is invalid or not active', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const referralCode = await generateUniqueReferralCode();
  let user: User;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          referralCode,
          passwordHash,
          role: 'WORKER',
          status: 'PENDING_EMAIL_VERIFICATION',
          appSetting: {
            create: {}
          },
          profile: {
            create: {
              fullName: profile.fullName,
              phone: profile.phone,
              normalizedPhone: profile.normalizedPhone,
              trade: 'Not specified',
              employmentType: 'FREELANCER'
            }
          }
        }
      });
      if (referrer) {
        await tx.referral.create({
          data: {
            referrerUserId: referrer.id,
            referredUserId: created.id,
            codeUsed: referrer.referralCode
          }
        });
      }
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthServiceError('Email or mobile number is already registered', 409);
    }
    throw error;
  }

  const verification = await createEmailVerification(user.id);
  const emailSent = await trySendVerificationEmail({
    to: user.email,
    code: verification.code,
    token: verification.token
  });

  try {
    ensureVerificationEmailWasSent(emailSent);
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } });
    throw error;
  }

  return buildRegistrationResult(
    user,
    verification,
    emailSent,
    isEmailDeliveryConfigured()
      ? 'Check your email to verify your account before logging in.'
      : 'Email sending is not configured. Use the dev verification code to verify this account.'
  );
}

export async function resendVerificationEmail(input: { email: string }): Promise<VerificationResendResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new AuthServiceError('A valid email is required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== UserStatus.PENDING_EMAIL_VERIFICATION || user.emailVerifiedAt) {
    return {
      verificationRequired: true,
      message: 'If this registration is pending, a new verification code will be sent.'
    };
  }

  const verification = await createEmailVerification(user.id);
  const emailSent = await trySendVerificationEmail({
    to: user.email,
    code: verification.code,
    token: verification.token
  });
  ensureVerificationEmailWasSent(emailSent);

  await prisma.emailVerificationToken.updateMany({
    where: {
      userId: user.id,
      id: { not: verification.id },
      consumedAt: null
    },
    data: { consumedAt: new Date() }
  });

  const registration = buildRegistrationResult(
    user,
    verification,
    emailSent,
    'A new verification code was sent to your email.'
  );
  const { user: safeUser, ...result } = registration;
  return { ...result, user: safeUser };
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
    ...(env.nodeEnv !== 'production'
      ? {
          devVerificationCode: verification.code,
          devVerificationToken: verification.token
        }
      : {}),
    message
  };
}

function ensureVerificationEmailWasSent(emailSent: boolean): void {
  if (env.nodeEnv === 'production' && (!isEmailDeliveryConfigured() || !emailSent)) {
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

async function trySendPasswordResetEmail(input: {
  to: string;
  code: string;
}): Promise<boolean> {
  try {
    if (!isEmailDeliveryConfigured()) {
      return false;
    }

    await Promise.race([
      sendPasswordResetEmail(input),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Password reset email delivery timed out')), 10000);
      })
    ]);
    return true;
  } catch (error) {
    console.error('Password reset email delivery failed', error);
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

export async function requestPasswordReset(input: { email: string }): Promise<PasswordResetRequestResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new AuthServiceError('A valid email is required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      resetRequired: true,
      message: 'If this email is registered, a password reset code will be sent.'
    };
  }

  const reset = await createPasswordReset(user.id);
  const emailSent = await trySendPasswordResetEmail({
    to: user.email,
    code: reset.code
  });

  if (env.nodeEnv === 'production' && (!isEmailDeliveryConfigured() || !emailSent)) {
    throw new AuthServiceError('Unable to send password reset email. Please try again later.', 502);
  }

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      id: { not: reset.id },
      consumedAt: null
    },
    data: { consumedAt: new Date() }
  });

  return {
    resetRequired: true,
    message: isEmailDeliveryConfigured()
      ? 'Check your email for the 6-digit password reset code.'
      : 'Email sending is not configured. Use the dev reset code.',
    ...(env.nodeEnv !== 'production' ? { devResetCode: reset.code } : {})
  };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  validateCredentials(email, input.password);

  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new AuthServiceError('Enter the 6-digit password reset code', 400);
  }

  const resetToken = await findPasswordResetByEmailAndCode(email, code);
  if (!resetToken || resetToken.consumedAt || resetToken.expiresAt < new Date()) {
    throw new AuthServiceError('Password reset code is invalid or expired', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, consumedAt: null },
      data: { consumedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    })
  ]);
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

  let verifiedUser: User;
  try {
    verifiedUser = await prisma.$transaction(async (tx) => {
      const verifiedAt = new Date();
      const referral = await tx.referral.findUnique({
        where: { referredUserId: verificationToken.userId },
        select: { id: true }
      });
      if (referral) {
        const profile = await tx.workerProfile.findUniqueOrThrow({
          where: { userId: verificationToken.userId },
          select: { normalizedPhone: true }
        });
        if (!profile.normalizedPhone) {
          throw new AuthServiceError('A valid mobile number is required for referral verification', 400);
        }
        await tx.referralPhoneClaim.create({
          data: { normalizedPhone: profile.normalizedPhone, userId: verificationToken.userId }
        });
      }
      await tx.emailVerificationToken.updateMany({
        where: { userId: verificationToken.userId, consumedAt: null },
        data: { consumedAt: verifiedAt }
      });

      const user = await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          status: 'ACTIVE',
          emailVerifiedAt: verifiedAt,
          lastSeenAt: verifiedAt
        }
      });

      await createTrialSubscriptionForUser(user.id, verifiedAt, tx);
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthServiceError('Mobile number has already been used for a referral account', 409);
    }
    throw error;
  }

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

function normalizeSignupProfile(
  fullName: string,
  phone: string
): { fullName: string; phone: string; normalizedPhone: string } {
  const normalizedName = fullName.trim();
  const normalizedPhone = phone.trim();
  if (!normalizedName) throw new AuthServiceError('Full name is required', 400);
  if (!normalizedPhone) throw new AuthServiceError('Mobile number is required', 400);
  const abuseControlPhone = normalizePhoneForAbuseControl(normalizedPhone);
  if (abuseControlPhone.length < 8) throw new AuthServiceError('Enter a valid mobile number', 400);
  return { fullName: normalizedName, phone: normalizedPhone, normalizedPhone: abuseControlPhone };
}

async function createEmailVerification(userId: string): Promise<{ id: string; token: string; code: string }> {
  const token = randomBytes(32).toString('hex');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  const record = await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationValue(token),
      codeHash: await bcrypt.hash(code, 12),
      expiresAt
    }
  });

  return { id: record.id, token, code };
}

async function createPasswordReset(userId: string): Promise<{ id: string; code: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  const record = await prisma.passwordResetToken.create({
    data: {
      userId,
      codeHash: await bcrypt.hash(code, 12),
      expiresAt
    }
  });

  return { id: record.id, code };
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

async function findPasswordResetByEmailAndCode(email: string, code: string) {
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return null;
  }

  const tokens = await prisma.passwordResetToken.findMany({
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
