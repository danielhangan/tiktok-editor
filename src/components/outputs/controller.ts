import type { OpenAPIHono } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { listOutputsRoute, deleteOutputRoute } from './schemas.js';
import { listOutputs } from '~/utils/storage.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';

export function registerOutputRoutes(app: OpenAPIHono) {
  app.openapi(listOutputsRoute, async (c) => {
    const outputs = listOutputs();

    return c.json(
      outputs.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        url: `/output/${f.filename}`,
        createdAt: f.createdAt.toISOString()
      }))
    );
  });

  app.openapi(deleteOutputRoute, async (c) => {
    const { id } = c.req.valid('param');
    const outputDir = path.join(env.DATA_DIR, 'output');
    const filePath = path.join(outputDir, `${id}.mp4`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ id }, 'Output deleted');
    }

    return c.json({ success: true });
  });
}
