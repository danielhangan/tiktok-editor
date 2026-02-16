import type { OpenAPIHono } from '@hono/zod-openapi';
import { getHooksRoute, setHooksRoute } from './schemas.js';
import { getHooks, setHooks } from '~/utils/storage.js';
import { logger } from '~/config/logger.js';

export function registerHooksRoutes(app: OpenAPIHono) {
  app.openapi(getHooksRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const hooks = getHooks(sessionId);
    return c.json(hooks);
  });

  app.openapi(setHooksRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const { hooks } = c.req.valid('json');

    setHooks(sessionId, hooks);
    logger.info({ sessionId, count: hooks.length }, 'Hooks saved');
    
    return c.json({ success: true, count: hooks.length });
  });
}

// Export for use in generate controller (needs sessionId now)
export { getHooks } from '~/utils/storage.js';
