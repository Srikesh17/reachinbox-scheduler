import { emailWorker, reconcileScheduledEmails, closeWorker } from './queue/worker.js';
import { pool } from './db/client.js';
import { emailQueue } from './queue/queue.js';

async function startStandaloneWorker() {
  console.log('[Worker] Standalone BullMQ worker process initialized');
  await reconcileScheduledEmails();

  const shutdown = async () => {
    console.log('\n[Worker] Gracefully stopping standalone worker...');
    await closeWorker();
    await emailQueue.close();
    await pool.end();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void startStandaloneWorker();
