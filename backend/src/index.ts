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

app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
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
