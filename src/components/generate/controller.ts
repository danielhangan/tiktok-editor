import type { OpenAPIHono } from '@hono/zod-openapi';
import { generateRoute, jobStatusRoute } from './schemas.js';
import { addJob, getJobStatus, updateJobStatus, queue } from '~/queue/index.js';
import { getFile, getOutputPath } from '~/utils/storage.js';
import { env, hasRedis } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { randomUUID } from 'crypto';
import { generateTikTokVideo } from '~/utils/ffmpeg.js';
import { getHooks } from '~/components/hooks/controller.js';

export function registerGenerateRoutes(app: OpenAPIHono) {
  app.openapi(generateRoute, async (c) => {
    const { combinations, textSettings } = c.req.valid('json');

    if (!combinations || combinations.length === 0) {
      return c.json({ error: 'No combinations specified' }, 400);
    }

    const hooks = getHooks();
    const batchId = randomUUID();
    const jobIds: string[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      const reaction = getFile('reactions', combo.reactionId);
      const demo = getFile('demos', combo.demoId);
      const hookText = combo.hookIndex >= 0 && hooks[combo.hookIndex] ? hooks[combo.hookIndex] : '';

      if (!reaction || !demo) {
        logger.warn({ combo }, 'Missing files for combination');
        continue;
      }

      const outputPath = getOutputPath(batchId, i + 1);

      const jobData = {
        reactionPath: reaction.path,
        demoPath: demo.path,
        hookText,
        outputPath,
        reactionDuration: env.REACTION_DURATION,
        width: env.OUTPUT_WIDTH,
        height: env.OUTPUT_HEIGHT,
        // Text styling options
        textMaxWidthPercent: textSettings?.maxWidthPercent ?? 60,
        textAlign: textSettings?.align ?? 'center',
        fontSize: textSettings?.fontSize ?? 38,
        textPosition: textSettings?.position ?? 'center'
      };

      const jobId = await addJob(jobData);
      jobIds.push(jobId);

      // If no Redis, process synchronously in background
      if (!hasRedis) {
        // Fire and forget - process in background
        processJobSync(jobId, jobData);
      }
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

// Synchronous job processing (when Redis is not available)
async function processJobSync(jobId: string, data: {
  reactionPath: string;
  demoPath: string;
  hookText: string;
  outputPath: string;
  reactionDuration: number;
  width: number;
  height: number;
  textMaxWidthPercent?: number;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
  textPosition?: 'top' | 'center' | 'bottom';
}) {
  updateJobStatus(jobId, 'active', 10);
  
  try {
    logger.info({ jobId, outputPath: data.outputPath }, 'Processing video (sync mode)');
    
    const outputPath = await generateTikTokVideo(data);
    
    updateJobStatus(jobId, 'completed', 100, {
      success: true,
      outputPath,
      outputUrl: `/output/${outputPath.split('/').pop()}`
    });
    
    logger.info({ jobId, outputPath }, 'Video generation completed (sync mode)');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, 'Video generation failed (sync mode)');
    
    updateJobStatus(jobId, 'failed', 100, {
      success: false,
      error: errorMessage
    });
  }
}
