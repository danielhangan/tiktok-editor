import { Worker, Job } from 'bullmq';
import { env, hasRedis } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { QUEUE_NAME, JobType, GenerateVideoDataSchema } from '~/queue/index.js';
import type { GenerateVideoData, JobResult } from '~/queue/index.js';
import { generateTikTokVideo } from '~/utils/ffmpeg.js';
import { ensureDirectories, getOutputUrlPath } from '~/utils/storage.js';

// Initialize
ensureDirectories();

if (!hasRedis) {
  logger.warn('⚠️ No Redis URL configured - worker not needed in sync mode');
  logger.info('The server will process jobs synchronously without this worker.');
  process.exit(0);
}

const connection = { url: env.REDIS_URL! };

async function processJob(job: Job<GenerateVideoData, JobResult>): Promise<JobResult> {
  const data = GenerateVideoDataSchema.parse(job.data);

  logger.info({ jobId: job.id, outputPath: data.outputPath }, 'Processing video generation job');

  try {
    await job.updateProgress(10);

    const outputPath = await generateTikTokVideo(data);

    await job.updateProgress(100);

    logger.info({ jobId: job.id, outputPath }, 'Video generation completed');

    const filename = outputPath.split('/').pop() || '';
    return {
      success: true,
      outputPath,
      outputUrl: getOutputUrlPath(filename, data.sessionId)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: job.id, error: errorMessage }, 'Video generation failed');

    return {
      success: false,
      error: errorMessage
    };
  }
}

const worker = new Worker<GenerateVideoData, JobResult>(
  QUEUE_NAME,
  async (job) => {
    if (job.name === JobType.GENERATE_VIDEO) {
      return processJob(job);
    }

    logger.warn({ jobName: job.name }, 'Unknown job type');
    return { success: false, error: 'Unknown job type' };
  },
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY
  }
);

worker.on('ready', () => {
  logger.info({ concurrency: env.WORKER_CONCURRENCY }, '🎬 TikTok Editor Worker started');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  process.exit(0);
});
