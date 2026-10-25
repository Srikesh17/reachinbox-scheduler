import { Worker, DelayedError } from 'bullmq';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { pool } from '../db/client.js';
import { config } from '../config.js';
import { checkAndConsumeHourlyLimit, acquireSendGapLock } from '../rateLimiter/hourlyLimiter.js';
import { enqueueEmailJob } from './queue.js';

interface EmailJobData {
  emailId: string;
}

const workerRedis = config.redisUrl
  ? new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  : new Redis({
      host: config.redisHost,
      port: config.redisPort,
      maxRetriesPerRequest: null,
    });

const limiterRedis = config.redisUrl
  ? new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  : new Redis({
      host: config.redisHost,
      port: config.redisPort,
      maxRetriesPerRequest: null,
    });

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) {
    return transporter;
  }

  if (config.smtpUser && config.smtpPass) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
    return transporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return transporter;
}

export const emailWorker = new Worker<EmailJobData>(
  'email-scheduler',
  async (job, token) => {
    const { emailId } = job.data;

    const claimResult = await pool.query(
      `UPDATE emails
       SET status = 'processing', updated_at = NOW()
       WHERE id = $1 AND status = 'scheduled'
       RETURNING *`,
      [emailId]
    );

    if (claimResult.rowCount === 0) {
      const existing = await pool.query(
        'SELECT status FROM emails WHERE id = $1',
        [emailId]
      );

      if (existing.rowCount === 0) {
        return;
      }

      const status = existing.rows[0].status;
      if (['sent', 'failed', 'processing'].includes(status)) {
        return;
      }
      return;
    }

    const email = claimResult.rows[0];
    const allowedHourly = Math.min(
      Number(email.hourly_limit) || config.maxEmailsPerHour,
      config.maxEmailsPerHour,
      100
    );

    const rateResult = await checkAndConsumeHourlyLimit(
      limiterRedis,
      email.sender,
      allowedHourly
    );

    if (!rateResult.allowed) {
      await pool.query(
        `UPDATE emails
         SET status = 'scheduled', updated_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [emailId]
      );

      await job.moveToDelayed(Date.now() + rateResult.retryAfterMs, token);
      throw new DelayedError();
    }

    const gapResult = await acquireSendGapLock(
      limiterRedis,
      config.minDelayBetweenSendsMs,
      String(job.id)
    );

    if (!gapResult.acquired) {
      const hourWindow = Math.floor(Date.now() / 3600000);
      await limiterRedis.decr(`rate:${email.sender}:${hourWindow}`);

      await pool.query(
        `UPDATE emails
         SET status = 'scheduled', updated_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [emailId]
      );

      await job.moveToDelayed(Date.now() + gapResult.retryAfterMs, token);
      throw new DelayedError();
    }

    try {
      const activeTransporter = await getTransporter();
      const sendFrom = email.sender || config.emailFrom;

      const info = await activeTransporter.sendMail({
        from: sendFrom,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
      });

      await pool.query(
        `UPDATE emails
         SET status = 'sent',
             sent_at = NOW(),
             message_id = $2,
             failure_reason = NULL,
             updated_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [emailId, info.messageId]
      );

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Worker] Sent email ${emailId} to ${email.recipient}`);
      if (previewUrl) {
        console.log(`[Worker] Ethereal Preview: ${previewUrl}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await pool.query(
        `UPDATE emails
         SET status = 'failed',
             failure_reason = $2,
             updated_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [emailId, message]
      );
      throw error;
    }
  },
  {
    connection: workerRedis,
    concurrency: config.workerConcurrency,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('[Worker] Worker internal error:', err);
});

export async function reconcileScheduledEmails() {
  try {
    await pool.query(
      `UPDATE emails
       SET status = 'scheduled', updated_at = NOW()
       WHERE status = 'processing'`
    );

    const pendingResult = await pool.query(
      `SELECT id, scheduled_at
       FROM emails
       WHERE status = 'scheduled'
       ORDER BY scheduled_at ASC`
    );

    for (const row of pendingResult.rows) {
      await enqueueEmailJob(row.id, new Date(row.scheduled_at));
    }
  } catch (err) {
    console.error('[Worker] Startup reconciliation error:', err);
  }
}

export async function closeWorker() {
  await emailWorker.close();
  await workerRedis.quit();
  await limiterRedis.quit();
}
