import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export interface VerificationEmailInput {
  to: string;
  code: string;
  token: string;
}

export interface PasswordResetEmailInput {
  to: string;
  code: string;
}

export function isEmailDeliveryConfigured(): boolean {
  if (env.nodeEnv === 'test') {
    return false;
  }

  return Boolean(env.email.smtpHost && env.email.smtpUser && env.email.smtpPass && env.email.from);
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.email.smtpHost,
    port: env.email.smtpPort,
    secure: env.email.smtpSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: env.email.smtpUser,
      pass: env.email.smtpPass.replace(/\s+/g, '')
    }
  });

  const verifyUrl = `${env.serverPublicUrl}/auth/verify-email?token=${encodeURIComponent(input.token)}`;

  await transporter.sendMail({
    from: env.email.from,
    to: input.to,
    subject: 'Verify your Dispute account',
    text: [
      'Welcome to Dispute.',
      '',
      `Your verification code is: ${input.code}`,
      '',
      `You can also verify using this link: ${verifyUrl}`,
      '',
      'This code expires in 30 minutes.',
      '',
      'If you did not create a Dispute account, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <h2>Verify your Dispute account</h2>
        <p>Welcome to Dispute.</p>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${input.code}</p>
        <p><a href="${verifyUrl}">Verify using this link</a></p>
        <p>This code expires in 30 minutes.</p>
        <p style="color: #666;">If you did not create a Dispute account, you can ignore this email.</p>
      </div>
    `
  });
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.email.smtpHost,
    port: env.email.smtpPort,
    secure: env.email.smtpSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: env.email.smtpUser,
      pass: env.email.smtpPass.replace(/\s+/g, '')
    }
  });

  await transporter.sendMail({
    from: env.email.from,
    to: input.to,
    subject: 'Reset your Dispute password',
    text: [
      'You requested a Dispute password reset.',
      '',
      `Your password reset code is: ${input.code}`,
      '',
      'This code expires in 30 minutes.',
      '',
      'If you did not request this reset, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <h2>Reset your Dispute password</h2>
        <p>You requested a Dispute password reset.</p>
        <p>Your password reset code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${input.code}</p>
        <p>This code expires in 30 minutes.</p>
        <p style="color: #666;">If you did not request this reset, you can ignore this email.</p>
      </div>
    `
  });
}
