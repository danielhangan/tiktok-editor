import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

export const extractAudioRoute = createRoute({
  method: 'post',
  path: '/api/tiktok/extract-audio',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            musicId: z.string(),
            filename: z.string(),
            title: z.string().optional(),
            author: z.string().optional()
          })
        }
      },
      description: 'Audio extracted successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            message: z.string().optional()
          })
        }
      },
      description: 'Invalid request'
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            message: z.string().optional()
          })
        }
      },
      description: 'Extraction failed'
    }
  },
  tags: ['TikTok']
});
