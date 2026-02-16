import { serve } from '@hono/node-server';
import { createApp } from '~/app.js';
import { env, hasRedis } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { ensureDirectories } from '~/utils/storage.js';

// Initialize directories
ensureDirectories();

if (hasRedis) {
  logger.info('✅ Redis configured - using async job processing');
} else {
  logger.warn('⚠️ No Redis - using synchronous processing (slower but works!)');
}

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    logger.info('🎬 TikTok Video Editor API started');
    logger.info({ 
      port: info.port, 
      dataDir: env.DATA_DIR,
      redis: hasRedis ? 'connected' : 'disabled'
    }, 'Server info');
    logger.info(`📚 OpenAPI Spec: http://localhost:${info.port}/doc`);
    logger.info(`📖 API Reference: http://localhost:${info.port}/reference`);
    logger.info(`🌐 Dashboard: http://localhost:${info.port}/`);
  }
);
