import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redisConnection = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-scheduler', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueEmailJob(emailId: string | number, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const jobId = `email-${emailId}`;

  return await emailQueue.add(
    'send-email',
    { emailId: String(emailId) },
    {
      jobId,
      delay,
    }
  );
}
