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

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

export const emailWorker = new Worker<EmailJobData>(
  'email-scheduler',
  async (job, token) => {
    const { emailId } = job.data;

    const emailQuery = await pool.query(
      'SELECT * FROM emails WHERE id = $1',
      [emailId]
    );

    if (emailQuery.rowCount === 0) {
      return;
    }

    const email = emailQuery.rows[0];
    if (email.status === 'sent') {
      return;
    }

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
         WHERE id = $1 AND status != 'sent'`,
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
         WHERE id = $1 AND status != 'sent'`,
        [emailId]
      );
      await job.moveToDelayed(Date.now() + gapResult.retryAfterMs, token);
      throw new DelayedError();
    }

    await pool.query(
      `UPDATE emails
       SET status = 'processing', updated_at = NOW()
       WHERE id = $1 AND status != 'sent'`,
      [emailId]
    );

    try {
      const activeTransporter = await getTransporter();
      const displayName = email.sender ? email.sender.split('@')[0] : 'ReachInbox';
      const fromHeader = config.smtpUser
        ? `"${displayName}" <${config.smtpUser}>`
        : (email.sender || config.emailFrom);

      const info = await activeTransporter.sendMail({
        from: fromHeader,
        to: email.recipient,
        replyTo: email.sender || config.emailFrom,
        bcc: config.smtpUser ? [config.smtpUser] : undefined,
        subject: email.subject,
        text: email.body,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || info.messageId || '';

      await pool.query(
        `UPDATE emails
         SET status = 'sent',
             sent_at = NOW(),
             message_id = $2,
             failure_reason = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [emailId, previewUrl]
      );

      console.log(`[Worker] Sent email ${emailId} to ${email.recipient}`);
      if (previewUrl) {
        console.log(`[Worker] Ethereal Preview: ${previewUrl}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const maxAttempts = job.opts.attempts || 3;
      const isFinalAttempt = job.attemptsMade >= maxAttempts;

      if (isFinalAttempt) {
        await pool.query(
          `UPDATE emails
           SET status = 'failed',
               failure_reason = $2,
               updated_at = NOW()
           WHERE id = $1 AND status = 'processing'`,
          [emailId, message]
        );
      } else {
        await pool.query(
          `UPDATE emails
           SET status = 'scheduled',
               failure_reason = $2,
               updated_at = NOW()
           WHERE id = $1 AND status = 'processing'`,
          [emailId, `Attempt ${job.attemptsMade} failed, retrying...`]
        );
      }
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
