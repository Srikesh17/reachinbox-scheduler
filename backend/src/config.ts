import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../../.env') });
dotenv.config({ path: path.resolve(currentDirectory, '../.env') });

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_EXTERNAL_URL);

let defaultFrontend = 'https://reachinbox-scheduler-theta-nine.vercel.app';
let configuredFrontend = process.env.FRONTEND_URL || defaultFrontend;
if (isProd && (configuredFrontend.includes('localhost') || configuredFrontend.includes('127.0.0.1'))) {
  configuredFrontend = defaultFrontend;
}

let defaultGoogleCallback = 'https://reachinbox-backend-pf01.onrender.com/api/auth/google/callback';
let configuredCallback = process.env.GOOGLE_CALLBACK_URL || defaultGoogleCallback;
if (isProd && (configuredCallback.includes('localhost') || configuredCallback.includes('127.0.0.1'))) {
  configuredCallback = defaultGoogleCallback;
}

export const config = {
  isProduction: isProd,
  port: Number(process.env.PORT || 4000),
  frontendUrl: configuredFrontend,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox@localhost:5432/reachinbox',
  redisUrl: process.env.REDIS_URL || '',
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  workerConcurrency: Math.max(1, Number(process.env.WORKER_CONCURRENCY || 5)),
  minDelayBetweenSendsMs: Math.max(0, Number(process.env.MIN_DELAY_BETWEEN_SENDS_MS || 2000)),
  maxEmailsPerHour: Math.min(100, Math.max(1, Number(process.env.MAX_EMAILS_PER_HOUR || 100))),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: configuredCallback,
  sessionSecret: process.env.SESSION_SECRET || 'reachinbox-scheduler-session-secret-key-prod',
  smtpHost: process.env.SMTP_HOST || 'smtp.ethereal.email',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || 'bethel.bergnaum87@ethereal.email',
  smtpPass: process.env.SMTP_PASS || 'EwZEtUKsjD1kBZCCT2',
  emailFrom: process.env.EMAIL_FROM || 'bethel.bergnaum87@ethereal.email',
  runWorkerInApp: process.env.RUN_WORKER !== 'false',
};
