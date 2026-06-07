export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'claimproof-local-dev-secret',
  jwtExpiresIn: '7d'
} as const;

export const isProduction = env.nodeEnv === 'production';
