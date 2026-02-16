import { z } from 'zod';

if (process.env['NODE_ENV'] !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis (optional - will use in-memory if not provided)
  REDIS_URL: z.string().optional(),

  DATA_DIR: z.string().default('./data'),
  TEMP_DIR: z.string().default('/tmp/tiktok-editor'),
  MAX_FILE_SIZE: z.coerce.number().default(500 * 1024 * 1024), // 500MB

  WORKER_CONCURRENCY: z.coerce.number().default(2),

  // Video settings
  REACTION_DURATION: z.coerce.number().default(4.5),
  OUTPUT_WIDTH: z.coerce.number().default(1080),
  OUTPUT_HEIGHT: z.coerce.number().default(1920),

  // S3-compatible storage (optional)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  AUTH_TOKEN: z.string().optional()
});

export const env = schema.parse(process.env);

export const hasRedis = !!env.REDIS_URL;
export const hasS3 = !!(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
