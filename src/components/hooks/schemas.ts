import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

export const getHooksRoute = createRoute({
  method: 'get',
  path: '/api/hooks',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.string())
        }
      },
      description: 'List of text hooks'
    }
  },
  tags: ['Hooks']
});

export const setHooksRoute = createRoute({
  method: 'post',
  path: '/api/hooks',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            hooks: z.array(z.string())
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
            count: z.number()
          })
        }
      },
      description: 'Hooks saved'
    }
  },
  tags: ['Hooks']
});
