import type { OpenAPIHono } from '@hono/zod-openapi';
import Redis from 'ioredis';
import { getHooksRoute, setHooksRoute } from './schemas.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';

const HOOKS_KEY = 'tiktok-editor:hooks';

// Lazy connection for hooks storage
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
  }
  return redis;
}

export function registerHooksRoutes(app: OpenAPIHono) {
  app.openapi(getHooksRoute, async (c) => {
    try {
      const hooks = await getRedis().lrange(HOOKS_KEY, 0, -1);
      return c.json(hooks);
    } catch {
      // Fallback if Redis fails
      return c.json([]);
    }
  });

  app.openapi(setHooksRoute, async (c) => {
    const { hooks } = c.req.valid('json');

    try {
      const r = getRedis();
      await r.del(HOOKS_KEY);
      if (hooks.length > 0) {
        await r.rpush(HOOKS_KEY, ...hooks);
      }
      logger.info({ count: hooks.length }, 'Hooks saved');
      return c.json({ success: true, count: hooks.length });
    } catch (error) {
      logger.error({ error }, 'Failed to save hooks');
      return c.json({ success: false, count: 0 });
    }
  });
}
