import type { OpenAPIHono } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { listOutputsRoute, deleteOutputRoute } from './schemas.js';
import { listOutputs, getOutputUrlPath } from '~/utils/storage.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';

export function registerOutputRoutes(app: OpenAPIHono) {
  app.openapi(listOutputsRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const outputs = listOutputs(sessionId);

    return c.json(
      outputs.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        url: getOutputUrlPath(f.filename, sessionId),
        createdAt: f.createdAt.toISOString()
      }))
    );
  });

  app.openapi(deleteOutputRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const { id } = c.req.valid('param');
    
    // Sanitize sessionId
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
    const outputDir = path.join(env.DATA_DIR, 'sessions', safeSessionId, 'output');
    const filePath = path.join(outputDir, `${id}.mp4`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ id, sessionId }, 'Output deleted');
    }

    return c.json({ success: true });
  });
}
