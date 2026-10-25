CREATE TABLE IF NOT EXISTS emails (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed')),
  delay_seconds INTEGER NOT NULL DEFAULT 2,
  hourly_limit INTEGER NOT NULL DEFAULT 200,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emails_status_scheduled_idx ON emails(status, scheduled_at);
CREATE INDEX IF NOT EXISTS emails_user_created_idx ON emails(user_email, created_at DESC);
