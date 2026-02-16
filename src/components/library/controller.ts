import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '~/config/logger.js';

const LIBRARY_DIR = './library/reactions';

// In-memory cache for library metadata (fast, doesn't need Redis)
let libraryCache: { files: any[]; cachedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const listLibraryRoute = createRoute({
  method: 'get',
  path: '/api/library/reactions',
  responses: {
    200: {
      description: 'List of stock library reactions',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            filename: z.string(),
            size: z.number(),
            url: z.string()
          }))
        }
      }
    }
  }
});

export function registerLibraryRoutes(app: OpenAPIHono) {
  // Serve library files statically with aggressive caching
  app.get('/library/reactions/:filename', async (c) => {
    const filename = c.req.param('filename');
    const filePath = path.join(LIBRARY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'Not found' }, 404);
    }
    
    const stats = fs.statSync(filePath);
    const etag = `"${stats.size}-${stats.mtimeMs}"`;
    
    // Check if client has cached version
    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }
    
    const file = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4' : 'video/quicktime';
    
    return new Response(file, {
      headers: { 
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year - files never change
        'ETag': etag,
        'Content-Length': String(stats.size)
      }
    });
  });

  app.openapi(listLibraryRoute, async (c) => {
    // Check memory cache first
    if (libraryCache && (Date.now() - libraryCache.cachedAt) < CACHE_TTL) {
      logger.debug({ count: libraryCache.files.length, cached: true }, 'Library reactions from cache');
      return c.json(libraryCache.files, 200, {
        'Cache-Control': 'public, max-age=3600' // Client can cache for 1 hour
      });
    }
    
    if (!fs.existsSync(LIBRARY_DIR)) {
      return c.json([]);
    }

    const files = fs.readdirSync(LIBRARY_DIR)
      .filter(f => /\.(mp4|mov)$/i.test(f))
      .map(filename => {
        const filePath = path.join(LIBRARY_DIR, filename);
        const stats = fs.statSync(filePath);
        const id = `lib_${filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        return {
          id,
          filename,
          size: stats.size,
          url: `/library/reactions/${encodeURIComponent(filename)}`
        };
      });

    // Update cache
    libraryCache = { files, cachedAt: Date.now() };
    
    logger.debug({ count: files.length, cached: false }, 'Library reactions listed');
    return c.json(files, 200, {
      'Cache-Control': 'public, max-age=3600'
    });
  });
}

// Helper to get library file path by ID
export function getLibraryReactionPath(id: string): string | null {
  if (!id.startsWith('lib_')) return null;
  
  const files = fs.readdirSync(LIBRARY_DIR).filter(f => /\.(mp4|mov)$/i.test(f));
  
  for (const filename of files) {
    const fileId = `lib_${filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (fileId === id) {
      return path.join(LIBRARY_DIR, filename);
    }
  }
  
  return null;
}
