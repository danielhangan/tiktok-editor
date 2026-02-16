import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

const FileInfoSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  size: z.number(),
  createdAt: z.string()
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional()
});

export const listFilesRoute = createRoute({
  method: 'get',
  path: '/api/files/{type}',
  request: {
    params: z.object({
      type: z.enum(['reactions', 'demos'])
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(FileInfoSchema)
        }
      },
      description: 'List of files'
    }
  },
  tags: ['Files']
});

export const uploadFilesRoute = createRoute({
  method: 'post',
  path: '/api/files/{type}',
  request: {
    params: z.object({
      type: z.enum(['reactions', 'demos'])
    }),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            files: z.array(z.instanceof(File)).or(z.instanceof(File))
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
            files: z.array(FileInfoSchema)
          })
        }
      },
      description: 'Files uploaded successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid request'
    }
  },
  tags: ['Files']
});

export const deleteFileRoute = createRoute({
  method: 'delete',
  path: '/api/files/{type}/{id}',
  request: {
    params: z.object({
      type: z.enum(['reactions', 'demos']),
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
      description: 'File deleted'
    }
  },
  tags: ['Files']
});
