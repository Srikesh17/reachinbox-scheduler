import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config } from './config.js';
import { initDb, pool } from './db/client.js';
import { authRouter } from './api/auth.routes.js';
import { scheduleRouter } from './api/schedule.routes.js';
import { emailQueue } from './queue/queue.js';
import { emailWorker, reconcileScheduledEmails, closeWorker } from './queue/worker.js';

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  'https://reachinbox-scheduler-theta-nine.vercel.app',
  'https://reachinbox-backend-pf01.onrender.com',
  config.frontendUrl,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

app.use(
  session({
    name: 'reachinbox.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: config.isProduction ? 'none' : 'lax',
      secure: config.isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const counts = await emailQueue.getJobCounts();
    res.json({
      status: 'ok',
      database: 'connected',
      queue: 'connected',
      jobCounts: counts,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Service unavailable',
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/emails', scheduleRouter);
app.use('/schedule', scheduleRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await initDb();
    console.log('[Database] Schema verified and ready');

    await reconcileScheduledEmails();
    console.log('[Queue] Startup reconciliation complete');

    const server = app.listen(config.port, () => {
      console.log(`[API] Server running on http://localhost:${config.port}`);
    });

    const shutdown = async () => {
      console.log('\n[API] Gracefully shutting down...');
      server.close();
      await closeWorker();
      await emailQueue.close();
      await pool.end();
      process.exit(0);
    };

    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void startServer();
