import { env } from './env.js';
import { logger } from './logger.js';

// BullMQ uses its own Redis connection, we just export the URL
export const redisUrl = env.REDIS_URL;

export async function checkRedisHealth(): Promise<void> {
  // BullMQ will handle connection, this is just a placeholder check
  logger.info({ redisUrl: env.REDIS_URL.replace(/\/\/.*@/, '//***@') }, '✅ Redis URL configured');
}
