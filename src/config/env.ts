import { z } from 'zod';

if (process.env['NODE_ENV'] !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  DATA_DIR: z.string().default('./data'),
  TEMP_DIR: z.string().default('/tmp/tiktok-editor'),
  MAX_FILE_SIZE: z.coerce.number().default(500 * 1024 * 1024), // 500MB

  WORKER_CONCURRENCY: z.coerce.number().default(2),

  // Video settings
  REACTION_DURATION: z.coerce.number().default(4.5),
  OUTPUT_WIDTH: z.coerce.number().default(1080),
  OUTPUT_HEIGHT: z.coerce.number().default(1920),

  AUTH_TOKEN: z.string().optional()
});

export const env = schema.parse(process.env);
