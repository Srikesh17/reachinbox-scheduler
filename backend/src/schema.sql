
CREATE TABLE IF NOT EXISTS emails (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    recipient TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,

    scheduled_at TIMESTAMPTZ NOT NULL,

    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'processing', 'sent', 'failed')),

    sent_at TIMESTAMPTZ,
    failure_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (length(trim(recipient)) > 0),
    CHECK (length(trim(sender_email)) > 0),
    CHECK (length(trim(subject)) > 0),
    CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_emails_status_scheduled_at
    ON emails (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_emails_sender_scheduled_at
    ON emails (sender_email, scheduled_at);