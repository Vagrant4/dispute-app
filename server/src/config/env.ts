const localJwtSecret = 'claimproof-local-dev-secret';
const minimumProductionJwtSecretLength = 32;

type EnvSource = Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'PORT' | 'CLIENT_ORIGIN' | 'JWT_SECRET'>>;

export function createEnv(source: EnvSource = process.env) {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const jwtSecret = source.JWT_SECRET ?? (nodeEnv === 'production' ? undefined : localJwtSecret);

  if (!jwtSecret || (nodeEnv === 'production' && jwtSecret.length < minimumProductionJwtSecretLength)) {
    throw new Error(
      `JWT_SECRET must be at least ${minimumProductionJwtSecretLength} characters in production`
    );
  }

  return {
    nodeEnv,
    port: Number(source.PORT ?? 4000),
    clientOrigin: source.CLIENT_ORIGIN ?? 'http://localhost:5173',
    jwtSecret,
    jwtExpiresIn: '7d'
  } as const;
}

export const env = createEnv();

export const isProduction = env.nodeEnv === 'production';
