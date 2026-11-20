import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { AuthServiceError } from './auth.service.js';
import { verifyIdentityToken } from './identityToken.service.js';

const relayLifetimeMs = 5 * 60 * 1000;

export async function startAppleAuthRelay(): Promise<{ state: string; nonce: string }> {
  const state = randomToken();
  const nonce = randomToken();
  await prisma.appleAuthRelayResult.create({
    data: {
      id: randomToken(),
      stateHash: hash(state),
      nonceHash: hash(nonce),
      expiresAt: new Date(Date.now() + relayLifetimeMs)
    }
  });
  return { state, nonce };
}

export async function completeAppleAuthRelay(input: { state: unknown; idToken: unknown }): Promise<string> {
  if (typeof input.state !== 'string' || typeof input.idToken !== 'string' || !input.state || !input.idToken) {
    throw new AuthServiceError('Apple sign-in response is invalid', 400);
  }

  const relay = await prisma.appleAuthRelayResult.findUnique({ where: { stateHash: hash(input.state) } });
  if (!relay || relay.usedAt || relay.expiresAt <= new Date()) {
    throw new AuthServiceError('Apple sign-in session has expired. Return to DISPUTE and try again.', 400);
  }

  await verifyIdentityToken({ provider: 'apple', idToken: input.idToken, audiences: env.socialAuth.appleAudiences });
  const nonce = getVerifiedNonce(input.idToken);
  if (!nonce || !safeEqual(hash(nonce), relay.nonceHash)) {
    throw new AuthServiceError('Apple sign-in response did not match this request', 401);
  }

  const claimed = await prisma.appleAuthRelayResult.updateMany({
    where: { id: relay.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { idToken: input.idToken }
  });
  if (claimed.count !== 1) throw new AuthServiceError('Apple sign-in session has expired. Return to DISPUTE and try again.', 400);
  return relay.id;
}

export async function consumeAppleAuthRelayResult(resultId: string): Promise<string> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const relay = await tx.appleAuthRelayResult.findUnique({ where: { id: resultId } });
    if (!relay || !relay.idToken || relay.usedAt || relay.expiresAt <= now) {
      throw new AuthServiceError('Apple sign-in result is invalid or has expired', 401);
    }
    const claimed = await tx.appleAuthRelayResult.updateMany({
      where: { id: relay.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now }
    });
    if (claimed.count !== 1) throw new AuthServiceError('Apple sign-in result is invalid or has expired', 401);
    return relay.idToken;
  });
}

function getVerifiedNonce(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { nonce?: unknown };
    return typeof payload.nonce === 'string' ? payload.nonce : null;
  } catch {
    return null;
  }
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
