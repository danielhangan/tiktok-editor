import { Queue, QueueEvents } from 'bullmq';
import { z } from 'zod';
import { env, hasRedis } from '~/config/env.js';
import { logger } from '~/config/logger.js';

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
  sessionId: z.string().default('default'),
  reactionDuration: z.number().default(4.5),
  width: z.number().default(1080),
  height: z.number().default(1920),
  // Text styling options
  textMaxWidthPercent: z.number().min(20).max(100).default(60),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  fontSize: z.number().min(16).max(80).default(38),
  textPosition: z.enum(['top', 'center', 'bottom']).default('center'),
  // Audio options
  musicPath: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.3)
});

export type GenerateVideoData = z.infer<typeof GenerateVideoDataSchema>;

export const QUEUE_NAME = 'tiktok-editor-jobs';

// In-memory job tracking for when Redis is not available
const inMemoryJobs = new Map<string, { state: string; progress: number; result?: JobResult }>();
let jobCounter = 0;

// BullMQ queue (only if Redis is available)
let queue: Queue<GenerateVideoData, JobResult> | null = null;
let queueEvents: QueueEvents | null = null;

if (hasRedis) {
  const connection = { url: env.REDIS_URL! };
  
  queue = new Queue<GenerateVideoData, JobResult>(QUEUE_NAME, {
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

  queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  logger.info('📦 BullMQ queue initialized with Redis');
} else {
  logger.warn('⚠️ Running without Redis - using synchronous processing');
}

export const addJob = async (data: GenerateVideoData): Promise<string> => {
  logger.debug({ data }, 'Adding video generation job');

  if (queue) {
    // Use BullMQ
    const job = await queue.add(JobType.GENERATE_VIDEO, data);
    logger.info({ jobId: job.id }, 'Job added to Redis queue');
    return job.id!;
  } else {
    // In-memory tracking - processing happens synchronously in the API
    const jobId = `inmem_${++jobCounter}`;
    inMemoryJobs.set(jobId, { state: 'waiting', progress: 0 });
    logger.info({ jobId }, 'Job tracked in memory');
    return jobId;
  }
};

export const updateJobStatus = (jobId: string, state: string, progress: number, result?: JobResult) => {
  if (!queue && inMemoryJobs.has(jobId)) {
    inMemoryJobs.set(jobId, { state, progress, result });
  }
};

export const getJobStatus = async (jobId: string) => {
  if (queue) {
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    return { id: job.id, state, progress, result };
  } else {
    const job = inMemoryJobs.get(jobId);
    if (!job) return null;
    return { id: jobId, ...job };
  }
};

export const validateJobResult = (result: unknown): JobResult => {
  try {
    return JobResultSchema.parse(result);
  } catch (error) {
    logger.error({ error, result }, 'Job result validation failed');
    throw new Error('Invalid job result format');
  }
};

export { queue, queueEvents };
