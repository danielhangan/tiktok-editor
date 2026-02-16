import type { OpenAPIHono } from '@hono/zod-openapi';
import Redis from 'ioredis';
import { getHooksRoute, setHooksRoute } from './schemas.js';
import { env, hasRedis } from '~/config/env.js';
import { logger } from '~/config/logger.js';

const HOOKS_KEY = 'tiktok-editor:hooks';

// In-memory storage fallback
let inMemoryHooks: string[] = [];

// Lazy Redis connection
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!hasRedis) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL!);
  }
  return redis;
}

export function registerHooksRoutes(app: OpenAPIHono) {
  app.openapi(getHooksRoute, async (c) => {
    try {
      const r = getRedis();
      if (r) {
        const hooks = await r.lrange(HOOKS_KEY, 0, -1);
        return c.json(hooks);
      } else {
        return c.json(inMemoryHooks);
      }
    } catch {
      return c.json(inMemoryHooks);
    }
  });

  app.openapi(setHooksRoute, async (c) => {
    const { hooks } = c.req.valid('json');

    try {
      const r = getRedis();
      if (r) {
        await r.del(HOOKS_KEY);
        if (hooks.length > 0) {
          await r.rpush(HOOKS_KEY, ...hooks);
        }
      }
      // Always update in-memory as fallback
      inMemoryHooks = hooks;
      
      logger.info({ count: hooks.length }, 'Hooks saved');
      return c.json({ success: true, count: hooks.length });
    } catch (error) {
      logger.error({ error }, 'Failed to save hooks to Redis, using memory');
      inMemoryHooks = hooks;
      return c.json({ success: true, count: hooks.length });
    }
  });
}

// Export for use in generate controller
export function getHooks(): string[] {
  return inMemoryHooks;
}
