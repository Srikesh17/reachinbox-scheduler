import { useState } from 'react';
import type { EmailItem } from '../types/email.js';

interface EmailTableProps {
  currentTab: 'scheduled' | 'sent';
  emails: EmailItem[];
  isLoading: boolean;
  onSelectEmail: (email: EmailItem) => void;
  onComposeClick: () => void;
}

function formatScheduledTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${weekday} ${time}`;
}

export function EmailTable({
  currentTab,
  emails,
  isLoading,
  onSelectEmail,
  onComposeClick,
}: EmailTableProps) {
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (isLoading) {
    return (
      <div className="email-table-loading-container d-flex flex-column align-items-center justify-content-center p-5 text-muted">
        <div className="loading-spinner-ring mb-3" />
        <span className="small">Loading emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="email-table-empty-container text-center p-5">
        <div className="empty-icon-circle mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-light text-muted" style={{ width: 56, height: 56 }}>
          <i className="fa-solid fa-inbox fs-4"></i>
        </div>
        <h5 className="empty-title-text fw-bold text-dark mb-1">
          {currentTab === 'scheduled'
            ? 'No scheduled emails found'
            : 'No sent emails yet'}
        </h5>
        <p className="empty-description-text text-muted small mb-3">
          {currentTab === 'scheduled'
            ? 'Schedule your outreach campaigns to see them queued here.'
            : 'Processed emails and delivery records will appear here.'}
        </p>
        {currentTab === 'scheduled' && (
          <button
            type="button"
            onClick={onComposeClick}
            className="empty-compose-btn btn btn-success rounded-pill px-4"
          >
            Compose New Email
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="email-rows-list-wrapper d-flex flex-column">
      {emails.map((email) => {
        const isStarred = Boolean(starredMap[email.id]);
        const recipientName =
          email.recipient.split('@')[0] || email.recipient;

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email)}
            className="email-row-card d-flex align-items-center justify-content-between px-4 py-3 border-bottom"
          >
            <div className="email-row-left d-flex align-items-center gap-3 flex-grow-1 overflow-hidden">
              <span className="email-to-label text-muted small text-nowrap">
                To: <span className="email-to-name fw-semibold text-dark">{recipientName}</span>
              </span>

              {currentTab === 'scheduled' ? (
                <div className="orange-scheduled-badge d-flex align-items-center gap-1 rounded-pill px-2 py-1 small fw-semibold text-nowrap">
                  <i className="fa-regular fa-clock" style={{ fontSize: '11px' }}></i>
                  <span>{formatScheduledTimestamp(email.scheduled_at)}</span>
                </div>
              ) : email.status === 'processing' ? (
                <div className="rounded-pill px-2 py-1 small fw-semibold text-nowrap bg-primary-subtle text-primary">
                  <i className="fa-solid fa-spinner fa-spin me-1"></i>
                  <span>Processing</span>
                </div>
              ) : (
                <div
                  className={`rounded-pill px-2 py-1 small fw-semibold text-nowrap ${
                    email.status === 'failed'
                      ? 'red-failed-badge'
                      : 'green-sent-badge'
                  }`}
                >
                  <span>{email.status === 'failed' ? 'Failed' : 'Sent'}</span>
                </div>
              )}

              <div className="email-subject-snippet-group d-flex align-items-center gap-2 overflow-hidden text-nowrap small">
                <span className="email-row-subject fw-semibold text-dark">{email.subject}</span>
                <span className="email-subject-separator text-muted">-</span>
                <span className="email-row-snippet text-muted text-truncate">
                  {email.body.replace(/\s+/g, ' ').slice(0, 100)}
                </span>
              </div>
            </div>

            <div className="email-row-right d-flex align-items-center gap-2 ms-2">
              {email.message_id && email.message_id.startsWith('http') && (
                <a
                  href={email.message_id}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="btn btn-sm btn-outline-success py-0 px-2 small text-nowrap"
                  title="Open test email preview"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                  <span>Preview</span>
                </a>
              )}
              <button
                type="button"
                onClick={(e) => toggleStar(email.id, e)}
                className="star-toggle-btn border-0 bg-transparent p-1"
                title={isStarred ? 'Unstar' : 'Star'}
              >
                <i
                  className={
                    isStarred
                      ? 'fa-solid fa-star text-warning'
                      : 'fa-regular fa-star text-secondary'
                  }
                ></i>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
