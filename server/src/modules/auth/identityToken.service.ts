import { createPublicKey, verify as verifySignature } from 'node:crypto';

import { AuthServiceError } from './auth.service.js';

export type SocialProvider = 'google' | 'apple';

type TokenPayload = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iss?: string;
  sub?: string;
};

type Jwk = JsonWebKey & { kid?: string; use?: string };

const issuerByProvider: Record<SocialProvider, readonly string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com']
};

const jwksUrlByProvider: Record<SocialProvider, string> = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: 'https://appleid.apple.com/auth/keys'
};

export async function verifyIdentityToken(
  input: { provider: SocialProvider; idToken: string; audiences: string[] },
  dependencies: { fetcher?: typeof fetch; nowSeconds?: number } = {}
): Promise<{ provider: SocialProvider; providerUserId: string; email: string }> {
  if (input.audiences.length === 0) {
    throw new AuthServiceError('Social sign-in is not configured on the server', 503);
  }
  const parts = input.idToken.split('.');
  if (parts.length !== 3) throw new AuthServiceError('Invalid identity token', 401);

  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodePart<TokenPayload>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new AuthServiceError('Invalid identity token', 401);
  if (!payload.sub || !payload.email || !isVerifiedEmail(payload.email_verified)) {
    throw new AuthServiceError('Identity provider did not verify an email address', 401);
  }
  if (!payload.iss || !issuerByProvider[input.provider].includes(payload.iss)) {
    throw new AuthServiceError('Invalid identity token issuer', 401);
  }
  if (!payload.exp || payload.exp <= (dependencies.nowSeconds ?? Math.floor(Date.now() / 1000))) {
    throw new AuthServiceError('Identity token has expired', 401);
  }
  const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!tokenAudiences.some((audience) => typeof audience === 'string' && input.audiences.includes(audience))) {
    throw new AuthServiceError('Identity token was issued for another application', 401);
  }

  const fetcher = dependencies.fetcher ?? fetch;
  let jwks: { keys?: Jwk[] };
  try {
    const response = await fetcher(jwksUrlByProvider[input.provider]);
    if (!response.ok) throw new Error('JWKS request failed');
    jwks = await response.json() as { keys?: Jwk[] };
  } catch {
    throw new AuthServiceError('Unable to validate identity token. Please try again.', 503);
  }
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new AuthServiceError('Identity token signing key was not found', 401);

  try {
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    const valid = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, decodeBase64Url(parts[2]));
    if (!valid) throw new Error('Signature mismatch');
  } catch {
    throw new AuthServiceError('Invalid identity token signature', 401);
  }

  return { provider: input.provider, providerUserId: payload.sub, email: normalizeEmail(payload.email) };
}

function decodePart<T>(part: string): T {
  try {
    return JSON.parse(decodeBase64Url(part).toString('utf8')) as T;
  } catch {
    throw new AuthServiceError('Invalid identity token', 401);
  }
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function isVerifiedEmail(value: TokenPayload['email_verified']): boolean {
  return value === true || value === 'true';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
