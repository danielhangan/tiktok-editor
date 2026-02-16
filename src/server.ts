import { serve } from '@hono/node-server';
import { createApp } from '~/app.js';
import { env } from '~/config/env.js';
import { checkRedisHealth } from '~/config/redis.js';
import { logger } from '~/config/logger.js';
import { ensureDirectories } from '~/utils/storage.js';

// Initialize
await checkRedisHealth();
ensureDirectories();

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    logger.info('🎬 TikTok Video Editor API started');
    logger.info({ port: info.port, dataDir: env.DATA_DIR }, 'Server info');
    logger.info(`📚 OpenAPI Spec: http://localhost:${info.port}/doc`);
    logger.info(`📖 API Reference: http://localhost:${info.port}/reference`);
  }
);
