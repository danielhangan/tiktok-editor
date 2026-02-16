import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { serveStatic } from '@hono/node-server/serve-static';
import { bearerAuth } from 'hono/bearer-auth';
import { cors } from 'hono/cors';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { registerUploadRoutes } from '~/components/upload/controller.js';
import { registerHooksRoutes } from '~/components/hooks/controller.js';
import { registerGenerateRoutes } from '~/components/generate/controller.js';
import { registerOutputRoutes } from '~/components/outputs/controller.js';
import { registerTikTokRoutes } from '~/components/tiktok/controller.js';
import { registerLibraryRoutes } from '~/components/library/controller.js';

export function createApp() {
  const app = new OpenAPIHono();

  // Middleware
  app.use('/*', cors());

  if (env.AUTH_TOKEN) {
    logger.info('🔒 Bearer authentication enabled');
    app.use('/api/*', bearerAuth({ token: env.AUTH_TOKEN }));
  } else {
    logger.warn('⚠️  Authentication disabled - set AUTH_TOKEN to enable');
  }

  // Session-scoped output files: /output/{sessionId}/{filename}
  app.get('/output/:sessionId/:filename', async (c) => {
    const { sessionId, filename } = c.req.param();
    
    // Sanitize sessionId to prevent directory traversal
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeFilename = path.basename(filename); // Prevent path traversal
    
    const filePath = path.join(env.DATA_DIR, 'sessions', safeSessionId, 'output', safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }
    
    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${safeFilename}"`
      }
    });
  });

  // Static files - serve React build, fall back to old public
  app.use('/*', serveStatic({ root: './public-react' }));
  app.use('/*', serveStatic({ root: './public' }));

  // Health check
  app.get('/health', (c) => c.text('OK'));

  // Register API routes
  registerUploadRoutes(app);
  registerHooksRoutes(app);
  registerGenerateRoutes(app);
  registerOutputRoutes(app);
  registerTikTokRoutes(app);
  registerLibraryRoutes(app);

  // OpenAPI documentation
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'TikTok Video Editor API',
      description: 'API for generating TikTok-style videos with reaction hooks and app demos'
    },
    servers: [
      {
        url: env.NODE_ENV === 'production' ? '' : `http://localhost:${env.PORT}`,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ]
  });

  app.get(
    '/reference',
    Scalar({
      url: '/doc',
      theme: 'purple',
      pageTitle: 'TikTok Editor API Reference'
    })
  );

  return app;
}
