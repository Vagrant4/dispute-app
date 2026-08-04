import 'dotenv/config';

const localJwtSecret = 'claimproof-local-dev-secret';
const minimumProductionJwtSecretLength = 32;
const stripeBillingModes = ['disabled', 'test', 'live'] as const;

export type StripeBillingMode = (typeof stripeBillingModes)[number];

type EnvSource = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | 'NODE_ENV'
    | 'PORT'
    | 'CLIENT_ORIGIN'
    | 'SERVER_PUBLIC_URL'
    | 'JWT_SECRET'
    | 'UPLOAD_ROOT'
    | 'STRIPE_SECRET_KEY'
    | 'STRIPE_WEBHOOK_SECRET'
    | 'STRIPE_PRICE_ID_MONTHLY'
    | 'STRIPE_PRICE_ID_YEARLY'
    | 'STRIPE_BILLING_MODE'
    | 'SMTP_HOST'
    | 'SMTP_PORT'
    | 'SMTP_SECURE'
    | 'SMTP_USER'
    | 'SMTP_PASS'
    | 'EMAIL_FROM'
    | 'SUPPORT_EMAIL'
    | 'REVENUECAT_WEBHOOK_SECRET'
    | 'REVENUECAT_SECRET_API_KEY'
    | 'REVENUECAT_PRODUCT_ID'
    | 'REVENUECAT_ENTITLEMENT_ID'
    | 'REVENUECAT_ALLOW_SANDBOX_EVENTS'
  >
>;

export function createEnv(source: EnvSource = process.env) {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const jwtSecret = source.JWT_SECRET ?? (nodeEnv === 'production' ? undefined : localJwtSecret);
  const stripeBillingMode = parseStripeBillingMode(source.STRIPE_BILLING_MODE);
  const serverPublicUrl = normalizeServerPublicUrl(source.SERVER_PUBLIC_URL);

  if (!jwtSecret || (nodeEnv === 'production' && jwtSecret.length < minimumProductionJwtSecretLength)) {
    throw new Error(
      `JWT_SECRET must be at least ${minimumProductionJwtSecretLength} characters in production`
    );
  }
  if (nodeEnv === 'production' && stripeBillingMode !== 'disabled') {
    throw new Error('STRIPE_BILLING_MODE must remain disabled in production mobile-store billing mode');
  }
  if (nodeEnv === 'production' && !serverPublicUrl.startsWith('https://')) {
    throw new Error('SERVER_PUBLIC_URL must use HTTPS in production');
  }

  return {
    nodeEnv,
    port: Number(source.PORT ?? 4000),
    clientOrigin: source.CLIENT_ORIGIN ?? 'http://localhost:5173',
    serverPublicUrl,
    jwtSecret,
    jwtExpiresIn: '7d',
    uploadRoot: source.UPLOAD_ROOT ?? `${process.cwd()}/uploads`,
    stripe: {
      billingMode: stripeBillingMode,
      secretKey: source.STRIPE_SECRET_KEY ?? '',
      webhookSecret: source.STRIPE_WEBHOOK_SECRET ?? '',
      priceIds: {
        monthly: source.STRIPE_PRICE_ID_MONTHLY ?? '',
        yearly: source.STRIPE_PRICE_ID_YEARLY ?? ''
      }
    },
    email: {
      smtpHost: source.SMTP_HOST ?? '',
      smtpPort: Number(source.SMTP_PORT ?? 465),
      smtpSecure: parseBoolean(source.SMTP_SECURE, true),
      smtpUser: source.SMTP_USER ?? '',
      smtpPass: source.SMTP_PASS ?? '',
      from: source.EMAIL_FROM ?? source.SMTP_USER ?? ''
    },
    supportEmail: source.SUPPORT_EMAIL?.trim() || '',
    revenueCat: {
      webhookSecret: source.REVENUECAT_WEBHOOK_SECRET ?? '',
      secretApiKey: source.REVENUECAT_SECRET_API_KEY ?? '',
      productId:
        source.REVENUECAT_PRODUCT_ID?.trim() ||
        (nodeEnv === 'production' ? '' : 'dispute_basic_monthly'),
      entitlementId:
        source.REVENUECAT_ENTITLEMENT_ID?.trim() ||
        (nodeEnv === 'production' ? '' : 'dispute_basic'),
      allowSandboxEvents: parseBoolean(source.REVENUECAT_ALLOW_SANDBOX_EVENTS, false)
    }
  } as const;
}

export const env = createEnv();

export const isProduction = env.nodeEnv === 'production';

function parseStripeBillingMode(value: string | undefined): StripeBillingMode {
  const billingMode = value?.trim() || 'disabled';
  if (stripeBillingModes.includes(billingMode as StripeBillingMode)) {
    return billingMode as StripeBillingMode;
  }

  throw new Error('STRIPE_BILLING_MODE must be one of disabled, test, live');
}

function normalizeServerPublicUrl(value: string | undefined): string {
  const rawUrl = value?.trim() || 'http://127.0.0.1:4000';
  return rawUrl.replace(/\/$/, '');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
