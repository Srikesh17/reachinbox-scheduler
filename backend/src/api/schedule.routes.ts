import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth } from './auth.routes.js';
import { enqueueEmailJob } from '../queue/queue.js';
import { config } from '../config.js';

export const scheduleRouter = Router();

scheduleRouter.use(requireAuth);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((v) => String(v).trim().toLowerCase())
          .filter((v) => EMAIL_REGEX.test(v))
      ),
    ];
  }
  if (typeof value === 'string') {
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map((v) => v.trim().toLowerCase()))];
  }
  return [];
}

scheduleRouter.post('/schedule', async (req: Request, res: Response) => {
  const {
    subject,
    body,
    recipients,
    startAt,
    delaySeconds,
    hourlyLimit,
    sender,
  } = req.body ?? {};

  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  const addressList = parseRecipients(recipients);

  if (!cleanSubject || !cleanBody) {
    res.status(400).json({ error: 'Subject and body are required fields.' });
    return;
  }

  if (addressList.length === 0) {
    res.status(400).json({ error: 'Provide at least one valid recipient email address.' });
    return;
  }

  const startDate = new Date(startAt || Date.now());
  const delay = Number(delaySeconds ?? 2);
  const hourly = Math.min(100, Number(hourlyLimit ?? config.maxEmailsPerHour));

  if (Number.isNaN(startDate.getTime())) {
    res.status(400).json({ error: 'Start time must be a valid date string.' });
    return;
  }

  if (!Number.isInteger(delay) || delay < 0 || delay > 600) {
    res.status(400).json({ error: 'Delay between emails must be between 0 and 600 seconds (maximum 10 minutes).' });
    return;
  }

  if (!Number.isInteger(hourly) || hourly < 1 || hourly > 100) {
    res.status(400).json({ error: 'Hourly limit must be between 1 and 100 emails per hour.' });
    return;
  }

  const senderEmail =
    typeof sender === 'string' && EMAIL_REGEX.test(sender)
      ? sender.trim()
      : req.session.user?.email || config.emailFrom;

  const client = await pool.connect();
  const createdEmails = [];

  try {
    await client.query('BEGIN');

    for (let i = 0; i < addressList.length; i++) {
      const scheduledTime = new Date(startDate.getTime() + i * delay * 1000);
      const insertResult = await client.query(
        `INSERT INTO emails (
          user_email,
          recipient,
          subject,
          body,
          sender,
          scheduled_at,
          delay_seconds,
          hourly_limit,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
        RETURNING *`,
        [
          req.session.user!.email,
          addressList[i],
          cleanSubject,
          cleanBody,
          senderEmail,
          scheduledTime,
          delay,
          hourly,
        ]
      );

      const emailRow = insertResult.rows[0];
      createdEmails.push(emailRow);
      await enqueueEmailJob(emailRow.id, scheduledTime);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully scheduled ${createdEmails.length} email(s).`,
      count: createdEmails.length,
      emails: createdEmails,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Email schedule request error:', error);
    res.status(500).json({ error: 'Failed to schedule emails.' });
  } finally {
    client.release();
  }
});

scheduleRouter.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        user_email,
        recipient,
        subject,
        body,
        sender,
        scheduled_at,
        status,
        delay_seconds,
        hourly_limit,
        created_at
       FROM emails
       WHERE user_email = $1
         AND status IN ('scheduled', 'processing')
       ORDER BY scheduled_at ASC
       LIMIT 2000`,
      [req.session.user!.email]
    );

    res.json({ emails: result.rows });
  } catch (error) {
    console.error('Failed to fetch scheduled emails:', error);
    res.status(500).json({ error: 'Could not load scheduled emails.' });
  }
});

scheduleRouter.get('/sent', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        user_email,
        recipient,
        subject,
        body,
        sender,
        scheduled_at,
        sent_at,
        status,
        failure_reason,
        message_id,
        created_at,
        updated_at
       FROM emails
       WHERE user_email = $1
         AND status IN ('sent', 'failed')
       ORDER BY COALESCE(sent_at, updated_at) DESC
       LIMIT 2000`,
      [req.session.user!.email]
    );

    res.json({ emails: result.rows });
  } catch (error) {
    console.error('Failed to fetch sent emails:', error);
    res.status(500).json({ error: 'Could not load sent emails.' });
  }
});

scheduleRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'processing')) AS scheduled_count,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
       FROM emails
       WHERE user_email = $1`,
      [req.session.user!.email]
    );

    const row = statsResult.rows[0];
    res.json({
      scheduled: Number(row.scheduled_count || 0),
      sent: Number(row.sent_count || 0),
      failed: Number(row.failed_count || 0),
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Could not retrieve stats.' });
  }
});

scheduleRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails WHERE id = $1 AND user_email = $2`,
      [req.params.id, req.session.user!.email]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Email not found.' });
      return;
    }

    res.json({ email: result.rows[0] });
  } catch (error) {
    console.error('Failed to fetch email details:', error);
    res.status(500).json({ error: 'Could not retrieve email.' });
  }
});
