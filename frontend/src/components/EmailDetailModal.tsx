import { useState } from 'react';
import { ArrowLeft, Star, Trash2, Archive, Paperclip } from 'lucide-react';
import type { EmailItem } from '../types/email.js';

interface EmailDetailModalProps {
  email: EmailItem;
  onBack: () => void;
}

export function EmailDetailModal({ email, onBack }: EmailDetailModalProps) {
  const [isStarred, setIsStarred] = useState(false);

  const formattedDate = new Date(
    email.sent_at || email.scheduled_at || email.created_at
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const senderInitial = (email.sender?.[0] || 'S').toUpperCase();

  return (
    <div className="email-detail-page-container">
      <div className="detail-top-action-bar">
        <div className="detail-title-left">
          <button
            type="button"
            onClick={onBack}
            className="detail-back-btn"
            title="Back to list"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="detail-subject-header">{email.subject}</h2>
        </div>

        <div className="detail-actions-right">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className="detail-icon-tool-btn"
            title="Star email"
          >
            <Star
              size={17}
              className={
                isStarred ? 'star-icon-filled' : 'star-icon-outline'
              }
            />
          </button>
          <button
            type="button"
            className="detail-icon-tool-btn"
            title="Archive"
          >
            <Archive size={17} />
          </button>
          <button
            type="button"
            className="detail-icon-tool-btn"
            title="Delete"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="detail-content-card">
        <div className="detail-sender-row">
          <div className="sender-avatar-initial-circle">
            <span>{senderInitial}</span>
          </div>

          <div className="sender-meta-group">
            <div className="sender-name-email-line">
              <span className="sender-display-name">{email.sender}</span>
              <span className="sender-to-me-pill">to me ▾</span>
            </div>
          </div>

          <div className="detail-timestamp-right">
            <span>{formattedDate}</span>
          </div>
        </div>

        <div className="detail-body-text-block">
          <p>{email.body}</p>

          <div className="detail-callout-banner">
            <div className="callout-line">
              <span className="lightning-icon">⚡</span>
              <span>
                Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000
                investment
              </span>
              <span className="lightning-icon">⚡</span>
            </div>
            <div className="callout-line">
              <span className="lightning-icon">⚡</span>
              <span>
                To explore securing your private transformation, simply reply right
                now with &quot;FLY OUT FIX&quot;
              </span>
            </div>
          </div>

          <div className="detail-signoff-block">
            <p>Your coach for world-class performance,</p>
            <p className="coach-signature-name">ReachInbox Team</p>
            <p className="coach-postscript-text">
              P.S. Always remember that you can develop world class technique! 🚀
            </p>
          </div>

          <div className="detail-attachments-section">
            <div className="attachment-badge-card">
              <div className="attachment-thumb-box">
                <Paperclip size={18} />
              </div>
              <div className="attachment-info-group">
                <span className="attachment-filename-text">
                  Outreach_Campaign_Brief.pdf
                </span>
                <span className="attachment-size-text">1.2 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
