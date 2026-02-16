import { Queue, QueueEvents } from 'bullmq';
import { z } from 'zod';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';

const connection = { url: env.REDIS_URL };

export const JobType = {
  GENERATE_VIDEO: 'generate:video'
} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export const JobResultSchema = z.object({
  success: z.boolean(),
  outputPath: z.string().optional(),
  outputUrl: z.string().optional(),
  error: z.string().optional()
});

export type JobResult = z.infer<typeof JobResultSchema>;

export const GenerateVideoDataSchema = z.object({
  reactionPath: z.string(),
  demoPath: z.string(),
  hookText: z.string(),
  outputPath: z.string(),
  reactionDuration: z.number().default(4.5),
  width: z.number().default(1080),
  height: z.number().default(1920)
});

export type GenerateVideoData = z.infer<typeof GenerateVideoDataSchema>;

export const QUEUE_NAME = 'tiktok-editor-jobs';

export const queue = new Queue<GenerateVideoData, JobResult>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      age: 3600,
      count: 100
    },
    removeOnFail: {
      age: 86400,
      count: 500
    }
  }
});

export const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

export const addJob = async (data: GenerateVideoData): Promise<string> => {
  logger.debug({ data }, 'Adding video generation job to queue');

  try {
    const job = await queue.add(JobType.GENERATE_VIDEO, data);
    logger.info({ jobId: job.id }, 'Job added to queue');
    return job.id!;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Failed to add job');
    throw error;
  }
};

export const getJobStatus = async (jobId: string) => {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;

  return { id: job.id, state, progress, result };
};

export const validateJobResult = (result: unknown): JobResult => {
  try {
    return JobResultSchema.parse(result);
  } catch (error) {
    logger.error({ error, result }, 'Job result validation failed');
    throw new Error('Invalid job result format from queue');
  }
};
