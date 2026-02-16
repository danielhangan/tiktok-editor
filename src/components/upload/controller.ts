import type { OpenAPIHono } from '@hono/zod-openapi';
import { listFilesRoute, uploadFilesRoute, deleteFileRoute } from './schemas.js';
import { listFiles, saveFile, deleteFile, getFile } from '~/utils/storage.js';
import { logger } from '~/config/logger.js';
import * as fs from 'fs';

export function registerUploadRoutes(app: OpenAPIHono) {
  app.openapi(listFilesRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const { type } = c.req.valid('param');
    const files = listFiles(type, sessionId);

    return c.json(
      files.map((f) => ({
        id: f.id,
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        createdAt: f.createdAt.toISOString()
      }))
    );
  });

  app.openapi(uploadFilesRoute, async (c) => {
    try {
      const sessionId = c.req.header('x-session-id') || 'default';
      const { type } = c.req.valid('param');
      const formData = await c.req.formData();
      const filesData = formData.getAll('files');

      const savedFiles = [];
      for (const file of filesData) {
        if (file instanceof File) {
          const saved = await saveFile(type, file, sessionId);
          savedFiles.push({
            id: saved.id,
            filename: saved.filename,
            originalName: saved.originalName,
            size: saved.size,
            createdAt: saved.createdAt.toISOString()
          });
        }
      }

      logger.info({ type, count: savedFiles.length, sessionId }, 'Files uploaded');
      return c.json({ success: true, files: savedFiles });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Upload failed');
      return c.json({ error: 'Upload failed', message }, 400);
    }
  });

  app.openapi(deleteFileRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const { type, id } = c.req.valid('param');
    deleteFile(type, id, sessionId);
    return c.json({ success: true });
  });

  // Preview endpoint for uploaded files
  app.get('/api/files/:type/:id/preview', async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const type = c.req.param('type');
    const id = c.req.param('id');
    
    const file = getFile(type, id, sessionId);
    if (!file || !fs.existsSync(file.path)) {
      return c.json({ error: 'Not found' }, 404);
    }
    
    const stats = fs.statSync(file.path);
    const stream = fs.createReadStream(file.path);
    const ext = file.path.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'mp3' ? 'audio/mpeg' : 'video/quicktime';
    
    return new Response(stream as any, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stats.size),
        'Cache-Control': 'private, max-age=3600'
      }
    });
  });
}
