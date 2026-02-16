import type { OpenAPIHono } from '@hono/zod-openapi';
import Redis from 'ioredis';
import { generateRoute, jobStatusRoute } from './schemas.js';
import { addJob, getJobStatus } from '~/queue/index.js';
import { getFile, getOutputPath } from '~/utils/storage.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { randomUUID } from 'crypto';

const HOOKS_KEY = 'tiktok-editor:hooks';

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
  }
  return redis;
}

export function registerGenerateRoutes(app: OpenAPIHono) {
  app.openapi(generateRoute, async (c) => {
    const { combinations } = c.req.valid('json');

    if (!combinations || combinations.length === 0) {
      return c.json({ error: 'No combinations specified' }, 400);
    }

    const hooks = await getRedis().lrange(HOOKS_KEY, 0, -1);
    const batchId = randomUUID();
    const jobIds: string[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      const reaction = getFile('reactions', combo.reactionId);
      const demo = getFile('demos', combo.demoId);
      const hookText = hooks[combo.hookIndex] || '';

      if (!reaction || !demo) {
        logger.warn({ combo }, 'Missing files for combination');
        continue;
      }

      const outputPath = getOutputPath(batchId, i + 1);

      const jobId = await addJob({
        reactionPath: reaction.path,
        demoPath: demo.path,
        hookText,
        outputPath,
        reactionDuration: env.REACTION_DURATION,
        width: env.OUTPUT_WIDTH,
        height: env.OUTPUT_HEIGHT
      });

      jobIds.push(jobId);
    }

    logger.info({ batchId, jobCount: jobIds.length }, 'Generation batch started');

    return c.json({
      success: true,
      jobIds,
      message: `Started ${jobIds.length} video generation jobs`
    });
  });

  app.openapi(jobStatusRoute, async (c) => {
    const { id } = c.req.valid('param');
    const status = await getJobStatus(id);

    if (!status) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json({
      id: status.id,
      state: status.state,
      progress: typeof status.progress === 'number' ? status.progress : undefined,
      result: status.result
    });
  });
}
