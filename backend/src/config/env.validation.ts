import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // 32 chars is a floor, not a target — production deployments should use
  // a randomly generated 64+ char secret (e.g. `openssl rand -base64 48`).
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().default(1025),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('SquadLink <no-reply@squadlink.gg>'),

  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:3000'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().optional(),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  TWITCH_CALLBACK_URL: z.string().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().optional(),

  STEAM_API_KEY: z.string().optional(),
  STEAM_CALLBACK_URL: z.string().optional(),
  STEAM_REALM: z.string().optional(),

  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().optional(),

  UPLOAD_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_LOCAL_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().default(10),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  THROTTLE_TTL_MS: z.coerce.number().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().default(120),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Extra checks that only make sense once NODE_ENV=production: they'd be
 * annoying friction in local dev (where a shared "dev secret" and
 * localhost CORS origin are fine) but are real misconfigurations in prod.
 */
function validateProductionInvariants(cfg: EnvConfig): string[] {
  if (cfg.NODE_ENV !== 'production') return [];
  const errors: string[] = [];

  if (cfg.CORS_ORIGIN.trim() === '*') {
    errors.push(
      'CORS_ORIGIN must not be "*" in production for a credentialed API',
    );
  }
  if (cfg.CORS_ORIGIN.includes('localhost')) {
    errors.push('CORS_ORIGIN still points at localhost in production');
  }
  if (cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET) {
    errors.push(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values',
    );
  }
  if (!cfg.APP_URL.startsWith('https://')) {
    errors.push('APP_URL must be an https:// URL in production');
  }
  if (!cfg.API_URL.startsWith('https://')) {
    errors.push('API_URL must be an https:// URL in production');
  }

  return errors;
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${message}`);
  }

  const productionErrors = validateProductionInvariants(parsed.data);
  if (productionErrors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${productionErrors.join('\n')}`,
    );
  }

  return parsed.data;
}
