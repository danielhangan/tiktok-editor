import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

const OutputFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  url: z.string(),
  createdAt: z.string()
});

export const listOutputsRoute = createRoute({
  method: 'get',
  path: '/api/outputs',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(OutputFileSchema)
        }
      },
      description: 'List of generated videos'
    }
  },
  tags: ['Outputs']
});

export const deleteOutputRoute = createRoute({
  method: 'delete',
  path: '/api/outputs/{id}',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean()
          })
        }
      },
      description: 'Output deleted'
    }
  },
  tags: ['Outputs']
});
