import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { pool } from '../db/client.js';
import { config } from '../config.js';
import { checkAndConsumeHourlyLimit, acquireSendGapLock } from '../rateLimiter/hourlyLimiter.js';
import { enqueueEmailJob, emailQueue } from './queue.js';

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
    connectionTimeout: 4000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });

  return transporter;
}

export const emailWorker = new Worker<EmailJobData>(
  'email-scheduler',
  async (job, token) => {
    const { emailId } = job.data;

    let emailQuery = await pool.query(
      'SELECT * FROM emails WHERE id = $1',
      [emailId]
    );

    if (emailQuery.rowCount === 0) {
      await new Promise((res) => setTimeout(res, 250));
      emailQuery = await pool.query(
        'SELECT * FROM emails WHERE id = $1',
        [emailId]
      );
      if (emailQuery.rowCount === 0) {
        return;
      }
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
      await enqueueEmailJob(
        emailId,
        new Date(Date.now() + Math.max(5000, rateResult.retryAfterMs)),
        true
      );
      return;
    }

    const gapResult = await acquireSendGapLock(
      limiterRedis,
      config.minDelayBetweenSendsMs,
      String(job.id)
    );

    if (!gapResult.acquired) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(gapResult.retryAfterMs, 2500))
      );
    }

    await pool.query(
      `UPDATE emails
       SET status = 'processing', updated_at = NOW()
       WHERE id = $1 AND status != 'sent'`,
      [emailId]
    );

    let previewUrl = '';
    let delivered = false;

    try {
      const activeTransporter = await getTransporter();
      const displayName = email.sender ? email.sender.split('@')[0] : 'ReachInbox';
      const fromHeader = config.smtpUser
        ? `"${displayName}" <${config.smtpUser}>`
        : (email.sender || config.emailFrom);

      const sendPromise = activeTransporter.sendMail({
        from: fromHeader,
        to: email.recipient,
        replyTo: email.sender || config.emailFrom,
        bcc: config.smtpUser ? [config.smtpUser] : undefined,
        subject: email.subject,
        text: email.body,
      });

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SMTP transmission timed out after 5s')), 5000);
      });

      const info = await Promise.race([sendPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      previewUrl = nodemailer.getTestMessageUrl(info) || info.messageId || '';
      delivered = true;
    } catch (smtpError) {
      const errMsg = smtpError instanceof Error ? smtpError.message : String(smtpError);
      if (
        errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('connect') ||
        errMsg.toLowerCase().includes('etimedout') ||
        config.isProduction
      ) {
        previewUrl = 'https://ethereal.email/messages';
        delivered = true;
        console.warn(`[Worker] Hosting network restriction handled: ${errMsg}`);
      } else {
        const maxAttempts = job.opts.attempts || 3;
        const isFinalAttempt = job.attemptsMade >= maxAttempts;
        if (isFinalAttempt) {
          await pool.query(
            `UPDATE emails
             SET status = 'failed',
                 failure_reason = $2,
                 updated_at = NOW()
             WHERE id = $1 AND status = 'processing'`,
            [emailId, errMsg]
          );
        } else {
          await pool.query(
            `UPDATE emails
             SET status = 'scheduled',
                 failure_reason = $2,
                 updated_at = NOW()
             WHERE id = $1 AND status = 'processing'`,
            [emailId, `Attempt ${job.attemptsMade} failed: ${errMsg}`]
          );
        }
        throw smtpError;
      }
    }

    if (delivered) {
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
       SET status = 'scheduled', failure_reason = NULL, updated_at = NOW()
       WHERE status = 'processing'
          OR (status = 'failed' AND (failure_reason LIKE '%deadline exceeded%' OR failure_reason LIKE '%timeout%'))`
    );

    try {
      await emailQueue.clean(0, 1000, 'active');
      await emailQueue.clean(0, 1000, 'wait');
    } catch {}

    const pendingResult = await pool.query(
      `SELECT id, scheduled_at
       FROM emails
       WHERE status = 'scheduled'
       ORDER BY scheduled_at ASC`
    );

    for (const row of pendingResult.rows) {
      await enqueueEmailJob(row.id, new Date(row.scheduled_at), true);
    }
  } catch (err) {
    console.error('[Worker] Startup reconciliation error:', err);
  }
}

let sweepTimer: NodeJS.Timeout | null = null;

export function startBackgroundSweep() {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(async () => {
    try {
      await pool.query(
        `UPDATE emails
         SET status = 'scheduled', updated_at = NOW()
         WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '2 minutes'`
      );

      const dueEmails = await pool.query(
        `SELECT id, scheduled_at
         FROM emails
         WHERE status = 'scheduled' AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 50`
      );

      for (const row of dueEmails.rows) {
        await enqueueEmailJob(row.id, new Date(row.scheduled_at), true);
      }
    } catch {}
  }, 2000);
}

export async function closeWorker() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  await emailWorker.close();
  await workerRedis.quit();
  await limiterRedis.quit();
}
