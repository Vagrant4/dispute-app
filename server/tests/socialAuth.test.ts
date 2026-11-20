import { generateKeyPairSync, sign } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db/prisma.js';
import { loginWithSocialIdentity } from '../src/modules/auth/auth.service.js';
import { verifyIdentityToken } from '../src/modules/auth/identityToken.service.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' };

function identityToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const body = encode(payload);
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), keys.privateKey).toString('base64url')}`;
}

beforeEach(async () => {
  await prisma.authIdentity.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('identity token verification', () => {
  it('accepts a signed Google token with the expected issuer, audience, expiry and verified email', async () => {
    const token = identityToken({
      iss: 'https://accounts.google.com', aud: 'web-client', sub: 'google-subject',
      email: 'Worker@Example.com', email_verified: true, exp: 2_000_000_000
    });
    await expect(verifyIdentityToken(
      { provider: 'google', idToken: token, audiences: ['web-client'] },
      { nowSeconds: 1_900_000_000, fetcher: async () => Response.json({ keys: [publicJwk] }) }
    )).resolves.toEqual({ provider: 'google', providerUserId: 'google-subject', email: 'worker@example.com' });
  });

  it('rejects a token with an unexpected audience or an unverified email', async () => {
    const token = identityToken({
      iss: 'https://appleid.apple.com', aud: 'other-client', sub: 'apple-subject',
      email: 'worker@example.com', email_verified: 'false', exp: 2_000_000_000
    });
    await expect(verifyIdentityToken(
      { provider: 'apple', idToken: token, audiences: ['services-id'] },
      { nowSeconds: 1_900_000_000, fetcher: async () => Response.json({ keys: [publicJwk] }) }
    )).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('social account creation and linking', () => {
  const verifyGoogle = async () => ({ provider: 'google' as const, providerUserId: 'google-subject', email: 'worker@example.com' });

  it('creates one active, verified trial account with no mobile number and no duplicate on repeat login', async () => {
    const first = await loginWithSocialIdentity({ provider: 'google', idToken: 'mock-token', fullName: 'Social Worker' }, { verifyToken: verifyGoogle });
    const second = await loginWithSocialIdentity({ provider: 'google', idToken: 'mock-token' }, { verifyToken: verifyGoogle });
    expect(second.id).toBe(first.id);
    expect(await prisma.user.count({ where: { email: 'worker@example.com' } })).toBe(1);
    await expect(prisma.workerProfile.findUnique({ where: { userId: first.id } })).resolves.toMatchObject({ fullName: 'Social Worker', phone: null });
    await expect(prisma.userSubscription.findUnique({ where: { userId: first.id } })).resolves.toMatchObject({ status: 'TRIALING' });
  });

  it('links a provider to an existing verified email account instead of creating a duplicate', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'worker@example.com', passwordHash: 'existing', status: 'ACTIVE', emailVerifiedAt: new Date(),
        appSetting: { create: {} }, profile: { create: { fullName: 'Existing Worker', phone: '+65 9000 0000', trade: 'Not specified', employmentType: 'FREELANCER' } }
      }
    });
    const result = await loginWithSocialIdentity({ provider: 'google', idToken: 'mock-token' }, { verifyToken: verifyGoogle });
    expect(result.id).toBe(user.id);
    expect(await prisma.user.count({ where: { email: 'worker@example.com' } })).toBe(1);
    await expect(prisma.authIdentity.findUnique({ where: { provider_providerUserId: { provider: 'google', providerUserId: 'google-subject' } } })).resolves.toMatchObject({ userId: user.id });
  });
});
