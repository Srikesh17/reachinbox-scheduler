# ReachInbox Full-Stack Email Job Scheduler

Production-grade email scheduling service and dashboard built with **TypeScript**, **Express.js**, **BullMQ**, **Redis**, **PostgreSQL**, and **React**. Designed to process outreach campaigns reliably under high load, survive server restarts without losing or duplicating jobs, enforce strict multi-worker rate limits, and provide a dashboard interface faithful to the ReachInbox Figma design.

---

## Live Deployments & Repository Access

- **Production Frontend (Vercel)**: [https://reachinbox-scheduler-theta-nine.vercel.app](https://reachinbox-scheduler-theta-nine.vercel.app)
- **Production Backend API (Render)**: [https://reachinbox-backend-pf01.onrender.com](https://reachinbox-backend-pf01.onrender.com)
- **GitHub Repository**: [https://github.com/Srikesh17/reachinbox-scheduler.git](https://github.com/Srikesh17/reachinbox-scheduler.git)
- **Reviewers Access**: Access granted to `Mitrajit` and `Yadav036`.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────────┐
                                      │        React Client (Vite)          │
                                      │   (OAuth / Lead CSV / Dashboard)    │
                                      └──────────────────┬──────────────────┘
                                                         │ HTTP REST
                                                         ▼
                                      ┌─────────────────────────────────────┐
                                      │         Express.js API Node         │
                                      │    (Session Auth, Ingestion API)    │
                                      └──────────┬──────────────────┬───────┘
                                                 │                  │
                         INSERT status='scheduled'                  │ Enqueue delayed job
                                                 │                  │ (jobId: 'email-' + id)
                                                 ▼                  ▼
┌───────────────────────────────┐     ┌──────────────────┐  ┌──────────────────┐
│   PostgreSQL (Source of Truth)│◄────┤  BullMQ Worker   ├──┤ Redis Job Queue  │
│  - emails table               │     │  - Concurrency: 5│  │  - Delayed Jobs  │
│  - Atomic status transitions  │     │  - Rate Limiter  │  │  - Hourly Keys   │
└───────────────────────────────┘     └──────────┬───────┘  └──────────────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────────────────────┐
                                      │         Ethereal Email SMTP         │
                                      │   (Fake SMTP delivery + preview)    │
                                      └─────────────────────────────────────┘
```

### 1. Durable Scheduling Without Cron
- Scheduled emails are enqueued directly as **BullMQ delayed jobs** backed by Redis.
- Delays are calculated as `Math.max(0, sendAt.getTime() - Date.now())`.
- Each BullMQ job is assigned `jobId: "email-${emailId}"`, which serves as an idempotency key preventing duplicate jobs in the queue.
- Absolutely **no cron jobs** (no OS-level crontab, no `node-cron`, no `agenda`).

### 2. Restart Persistence & Zero Lost Jobs
- **Redis Queue Persistence**: BullMQ delayed jobs are persisted in Redis sorted sets. When the backend or worker restarts, BullMQ immediately reconnects and resumes processing delayed jobs when their execution timestamp is reached.
- **Relational Source of Truth**: PostgreSQL stores every email state (`scheduled`, `processing`, `sent`, `failed`).
- **Startup Reconciliation**: On server/worker boot, the system runs `reconcileScheduledEmails()`:
  1. Any jobs stuck in `processing` (due to an unexpected process termination mid-send) are reset back to `scheduled`.
  2. All emails marked `scheduled` in PostgreSQL are re-verified with the queue. Because BullMQ deduplicates identical `jobId`s, existing queue jobs remain untouched, while any orphaned jobs are securely restored.

### 3. Worker Concurrency & Multi-Worker Throttling
- **Configurable Concurrency**: BullMQ workers run with configurable concurrency via `WORKER_CONCURRENCY` (default: 5 concurrent jobs).
- **Inter-Send Minimum Gap (Provider Throttling)**: Configurable via `MIN_DELAY_BETWEEN_SENDS_MS` (default: 2000 ms). Enforced across all concurrent workers using a shared Redis atomic lock key (`email-send-gap-lock`). If a worker attempts to send an email before the minimum spacing has elapsed, the job is delayed by the remaining lock TTL via `job.moveToDelayed()` without incrementing failure counts.

### 4. Hourly Rate Limiting & Order Preservation
- Configurable globally via `MAX_EMAILS_PER_HOUR` (default: 200) and customizable per sender.
- Backed by distributed Redis keys: `rate:${sender}:${hourWindow}` where `hourWindow = Math.floor(Date.now() / 3600000)`.
- When the hourly threshold is reached:
  1. The Redis counter is decremented back.
  2. The email row status remains `scheduled`.
  3. The job is rescheduled into the start of the next hour window using `job.moveToDelayed(nextHourTimestamp, token)` and `DelayedError`.
  4. The job is **never dropped, cancelled, or failed**.

### 5. Idempotency & Duplicate Send Protection
- Before sending, the worker executes an atomic conditional update:
  ```sql
  UPDATE emails
  SET status = 'processing', updated_at = NOW()
  WHERE id = $1 AND status = 'scheduled'
  RETURNING *;
  ```
- If zero rows are returned, another worker or process has already claimed or completed the email, preventing duplicate deliveries.
- The database status is only transitioned to `sent` after Ethereal SMTP acknowledges the message delivery.

---

## Features Implemented

| Requirement Category | Implemented Capabilities |
| :--- | :--- |
| **Backend Core** | Express API, PostgreSQL database schema with migration runner, BullMQ Redis delayed queue, Ethereal fake SMTP delivery with console preview links. |
| **Throughput & Limits** | Configurable worker concurrency, distributed Redis rate counters per sender per hour, minimum send delay lock, automatic job rescheduling on limit exhaustion. |
| **Persistence & Safety** | State persistence across restarts, BullMQ deduplication by job ID, atomic claim state machine (`scheduled` -> `processing` -> `sent` / `failed`). |
| **Frontend Authentication**| Real Google OAuth 2.0 flow (`/api/auth/google`, `/api/auth/google/callback`), session-based auth with HTTP-only cookies, user avatar & profile header, one-click demo login option. |
| **Frontend Dashboard** | 90%+ faithful Figma replication, sidebar navigation with real-time badges, header search with live client-side filtering, Scheduled view with orange timestamp pills, Sent view with status badges. |
| **Compose & Lead Upload** | Multi-recipient modal, CSV & TXT lead list upload with regex email parser, delay between emails configuration, hourly limit selector, Send Later popover with calendar picker and quick test presets. |
| **Email Detail View** | Full conversation preview with stylized callout banners, attachment cards, action buttons (star, delete, archive). |

---

## Project Structure

```
reachinbox-scheduler/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.routes.ts          # Google OAuth, login, session handlers
│   │   │   └── schedule.routes.ts      # POST /schedule, GET /scheduled, GET /sent
│   │   ├── db/
│   │   │   ├── client.ts               # PostgreSQL connection pool & migrations
│   │   │   └── schema.sql              # Relational schema & indexing
│   │   ├── queue/
│   │   │   ├── queue.ts                # BullMQ queue setup & enqueue helpers
│   │   │   └── worker.ts               # BullMQ worker, Ethereal SMTP & idempotency
│   │   ├── rateLimiter/
│   │   │   └── hourlyLimiter.ts        # Redis rate counters & send gap lock
│   │   ├── config.ts                   # Environment configuration loader
│   │   ├── index.ts                    # Express server entry & reconciliation
│   │   └── worker.ts                   # Standalone worker process entry
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ComposeModal.tsx        # Campaign compose, CSV upload & Send Later popover
│   │   │   ├── EmailDetailModal.tsx    # Single email conversation view
│   │   │   ├── EmailTable.tsx          # Scheduled & Sent tables with Figma badges
│   │   │   ├── Header.tsx              # Search pill & filter actions
│   │   │   ├── LoginCard.tsx           # Google login & credentials card
│   │   │   └── Sidebar.tsx             # QNB branding, user card, compose & core nav
│   │   ├── lib/
│   │   │   └── api.ts                  # Typed API client
│   │   ├── types/
│   │   │   └── email.ts                # Shared TypeScript models
│   │   ├── App.tsx                     # Top-level view router & state
│   │   ├── index.css                   # Custom styling adhering to Figma
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml                  # PostgreSQL 16 & Redis 7 services
├── .env.example
└── README.md
```

---

## Setup & Running Guide

### Prerequisites
- **Node.js**: v18+ (v20 or v22 recommended)
- **Redis** & **PostgreSQL**: Either via Docker or locally installed

---

### Step 1: Start Infrastructure (Redis + PostgreSQL)

If you have Docker installed, start Redis and PostgreSQL in one command:
```bash
docker compose up -d
```

> **Note for Local DB / Redis**: If running without Docker, ensure PostgreSQL is running on port `5432` with user `reachinbox` and password `reachinbox` (or edit `DATABASE_URL` in `.env`), and Redis is running on port `6379`.

---

### Step 2: Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Review or edit `.env`:
```env
# Database & Redis
DATABASE_URL=postgresql://reachinbox:reachinbox@localhost:5432/reachinbox
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Server Ports
PORT=4000
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:4000
SESSION_SECRET=reachinbox-scheduler-production-secret-session-key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

# Ethereal Fake SMTP
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password
EMAIL_FROM=ReachInbox Demo <no-reply@example.com>

# Worker Controls
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
MAX_EMAILS_PER_HOUR=200
RUN_WORKER=true
```

> **Ethereal Email Setup**:
> 1. Visit [https://ethereal.email/create](https://ethereal.email/create) to generate free fake SMTP credentials in 5 seconds.
> 2. Copy the generated Username into `SMTP_USER` and Password into `SMTP_PASS`.
> *(Even if credentials are left blank, the worker automatically provisions an ephemeral Ethereal test account on the fly and prints preview links in the console).*

---

### Step 3: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

---

### Step 4: Run the Application

You can run both services from the root or in separate terminal windows:

#### Terminal 1: Backend API + Worker
```bash
npm run dev:backend
```
*(The backend API starts on `http://localhost:4000` and automatically boots the BullMQ worker and runs DB schema migrations).*

#### Terminal 2: Frontend Dashboard
```bash
npm run dev:frontend
```
*(The React UI opens on `http://localhost:5173`).*

---

## Testing Scenarios for Evaluation

### 1. Google OAuth & Demo Login
- Open `http://localhost:5173`.
- Click **Login with Google** to complete standard Google OAuth authentication.
- Alternatively, click **One-Click Demo Login (Oliver Brown)** to test instantly with a preloaded profile.

### 2. Schedule New Emails & CSV Upload
- Click **Compose** in the left sidebar.
- Enter Subject and Body.
- In the **To** field, type an email address and press `Enter` or `,`.
- Click **Upload List** and select any CSV or text file containing email addresses (e.g., `user1@test.com, user2@test.com`). The interface parses the list and displays recipient chips.
- Click the **Clock icon** or **Send Later** button:
  - Choose **⚡ Send in 10 seconds (Quick Test)** or pick a specific date & time.
- Click **Send Later** to schedule the campaign.

### 3. Server Restart Scenario (Persistence Verification)
1. In the Compose modal, schedule 3 emails for **2 minutes into the future**.
2. Confirm the 3 emails appear in the **Scheduled** tab.
3. Stop the backend server in Terminal 1 (`Ctrl + C`).
4. Wait 15 seconds.
5. Restart the backend server (`npm run dev:backend`).
6. Observe that when the scheduled timestamp arrives, the worker picks up the jobs from Redis and sends them without duplicate sends or lost jobs.
7. Click the **Refresh** icon in the dashboard or switch to the **Sent** tab: the emails transition to `Sent`, and Ethereal preview links appear in the backend terminal logs.

### 4. Rate Limiting & Concurrency Under Load
- Minimum delay gap is set to 2 seconds (`MIN_DELAY_BETWEEN_SENDS_MS=2000`). When 10 emails are scheduled for the exact same second, the BullMQ worker processes them spaced by at least 2 seconds.
- When `MAX_EMAILS_PER_HOUR` is exceeded, the worker reschedules the overflow jobs into the beginning of the next hour window via `job.moveToDelayed()` without marking them failed.

---

## Assumptions & Trade-offs
1. **Redis Lock for Inter-Send Delay**: A Redis key with millisecond TTL (`email-send-gap-lock`) was chosen over BullMQ's built-in queue rate limiter because it coordinates across multiple independent worker nodes while allowing other queue operations to remain responsive.
2. **Delayed Job vs Outbox Polling**: Delayed jobs in BullMQ are inherently ordered and low-latency, avoiding periodic DB polling queries (`SELECT ... FOR UPDATE SKIP LOCKED`) while respecting the strict "no cron" constraint.
3. **Automatic Ethereal Fallback**: To ensure zero setup blockers during local code review, `nodemailer.createTestAccount()` automatically provisions an ephemeral Ethereal account if valid credentials are not supplied in `.env`.
