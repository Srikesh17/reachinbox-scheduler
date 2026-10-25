import { useState } from 'react';
import { Clock, Star, Inbox } from 'lucide-react';
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
      <div className="email-table-loading-container">
        <div className="loading-spinner-ring" />
        <span className="loading-state-text">Loading emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="email-table-empty-container">
        <div className="empty-icon-circle">
          <Inbox size={28} />
        </div>
        <h3 className="empty-title-text">
          {currentTab === 'scheduled'
            ? 'No scheduled emails found'
            : 'No sent emails yet'}
        </h3>
        <p className="empty-description-text">
          {currentTab === 'scheduled'
            ? 'Schedule your outreach campaigns to see them queued here.'
            : 'Processed emails and delivery records will appear here.'}
        </p>
        {currentTab === 'scheduled' && (
          <button
            type="button"
            onClick={onComposeClick}
            className="empty-compose-btn"
          >
            Compose New Email
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="email-rows-list-wrapper">
      {emails.map((email) => {
        const isStarred = Boolean(starredMap[email.id]);
        const recipientName =
          email.recipient.split('@')[0] || email.recipient;

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email)}
            className="email-row-card"
          >
            <div className="email-row-left">
              <span className="email-to-label">
                To: <span className="email-to-name">{recipientName}</span>
              </span>

              {currentTab === 'scheduled' ? (
                <div className="orange-scheduled-badge">
                  <Clock size={12} className="badge-clock-icon" />
                  <span>{formatScheduledTimestamp(email.scheduled_at)}</span>
                </div>
              ) : (
                <div
                  className={
                    email.status === 'failed'
                      ? 'red-failed-badge'
                      : 'gray-sent-badge'
                  }
                >
                  <span>{email.status === 'failed' ? 'Failed' : 'Sent'}</span>
                </div>
              )}

              <div className="email-subject-snippet-group">
                <span className="email-row-subject">{email.subject}</span>
                <span className="email-subject-separator">-</span>
                <span className="email-row-snippet">
                  {email.body.replace(/\s+/g, ' ').slice(0, 100)}
                </span>
              </div>
            </div>

            <div className="email-row-right">
              <button
                type="button"
                onClick={(e) => toggleStar(email.id, e)}
                className="star-toggle-btn"
                title={isStarred ? 'Unstar' : 'Star'}
              >
                <Star
                  size={16}
                  className={
                    isStarred
                      ? 'star-icon-filled'
                      : 'star-icon-outline'
                  }
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
