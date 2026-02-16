import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

const CombinationSchema = z.object({
  reactionId: z.string(),
  demoId: z.string(),
  hookIndex: z.number()
});

const JobStatusSchema = z.object({
  id: z.string(),
  state: z.string(),
  progress: z.number().optional(),
  result: z
    .object({
      success: z.boolean(),
      outputPath: z.string().optional(),
      error: z.string().optional()
    })
    .optional()
});

export const generateRoute = createRoute({
  method: 'post',
  path: '/api/generate',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            combinations: z.array(CombinationSchema)
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
            jobIds: z.array(z.string()),
            message: z.string()
          })
        }
      },
      description: 'Generation jobs started'
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Invalid request'
    }
  },
  tags: ['Generate']
});

export const jobStatusRoute = createRoute({
  method: 'get',
  path: '/api/jobs/{id}',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: JobStatusSchema
        }
      },
      description: 'Job status'
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Job not found'
    }
  },
  tags: ['Generate']
});
