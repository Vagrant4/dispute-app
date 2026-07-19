import { describe, expect, it } from 'vitest';
import { createEnv } from '../src/config/env.js';

describe('email SMTP configuration', () => {
  it('defaults email delivery to unconfigured for local development', () => {
    const env = createEnv({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret'
    });

    expect(env.email).toMatchObject({
      smtpHost: '',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: '',
      smtpPass: '',
      from: ''
    });
  });

  it('accepts Gmail SMTP app-password settings for verification email tests', () => {
    const env = createEnv({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'tester@example.com',
      SMTP_PASS: 'app-password-only',
      EMAIL_FROM: 'Dispute <tester@example.com>'
    });

    expect(env.email).toMatchObject({
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'tester@example.com',
      smtpPass: 'app-password-only',
      from: 'Dispute <tester@example.com>'
    });
  });

  it('defaults verification links to the local server only outside public deployment', () => {
    const env = createEnv({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret'
    });

    expect(env.serverPublicUrl).toBe('http://127.0.0.1:4000');
  });
});
