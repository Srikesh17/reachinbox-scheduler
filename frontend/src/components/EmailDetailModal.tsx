import { useState } from 'react';
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
    <div className="email-detail-page-container d-flex flex-column flex-grow-1">
      <div className="detail-top-action-bar d-flex align-items-center justify-content-between p-3 border-bottom">
        <div className="detail-title-left d-flex align-items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="detail-back-btn border-0 bg-transparent text-secondary p-1"
            title="Back to list"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h5 className="detail-subject-header mb-0 fw-bold text-dark">{email.subject}</h5>
        </div>

        <div className="detail-actions-right d-flex align-items-center gap-3">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className="detail-icon-tool-btn border-0 bg-transparent text-secondary p-1"
            title="Star email"
          >
            <i
              className={
                isStarred ? 'fa-solid fa-star text-warning' : 'fa-regular fa-star'
              }
            ></i>
          </button>
          <button
            type="button"
            className="detail-icon-tool-btn border-0 bg-transparent text-secondary p-1"
            title="Archive"
          >
            <i className="fa-solid fa-box-archive"></i>
          </button>
          <button
            type="button"
            className="detail-icon-tool-btn border-0 bg-transparent text-secondary p-1"
            title="Delete"
          >
            <i className="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>

      <div className="detail-content-card p-4 d-flex flex-column gap-3">
        <div className="detail-sender-row d-flex align-items-center gap-3">
          <div className="sender-avatar-initial-circle rounded-circle d-flex align-items-center justify-content-center text-white fw-bold bg-success" style={{ width: 40, height: 40 }}>
            <span>{senderInitial}</span>
          </div>

          <div className="sender-meta-group d-flex flex-column flex-grow-1">
            <div className="sender-name-email-line d-flex align-items-center gap-2">
              <span className="sender-display-name fw-bold small text-dark">{email.sender}</span>
              <span className="sender-to-me-pill text-muted small">to me ▾</span>
            </div>
          </div>

          <div className="detail-timestamp-right text-muted small">
            <span>{formattedDate}</span>
          </div>
        </div>

        <div className="detail-body-text-block d-flex flex-column gap-3">
          <p className="mb-0 text-secondary">{email.body}</p>

          <div className="detail-callout-banner p-3 rounded">
            <div className="callout-line d-flex align-items-center gap-2 mb-1">
              <span className="lightning-icon">⚡</span>
              <span className="small fw-semibold">
                Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000
                investment
              </span>
              <span className="lightning-icon">⚡</span>
            </div>
            <div className="callout-line d-flex align-items-center gap-2">
              <span className="lightning-icon">⚡</span>
              <span className="small">
                To explore securing your private transformation, simply reply right
                now with &quot;FLY OUT FIX&quot;
              </span>
            </div>
          </div>

          <div className="detail-signoff-block small">
            <p className="mb-1 text-muted">Your coach for world-class performance,</p>
            <p className="coach-signature-name fw-bold text-dark mb-1">ReachInbox Team</p>
            <p className="coach-postscript-text fst-italic text-muted">
              P.S. Always remember that you can develop world class technique! 🚀
            </p>
          </div>

          <div className="detail-attachments-section mt-2">
            <div className="attachment-badge-card d-inline-flex align-items-center gap-2 border rounded p-2 bg-light">
              <div className="attachment-thumb-box text-success">
                <i className="fa-solid fa-paperclip"></i>
              </div>
              <div className="attachment-info-group d-flex flex-column">
                <span className="attachment-filename-text small fw-semibold text-dark">
                  Outreach_Campaign_Brief.pdf
                </span>
                <span className="attachment-size-text text-muted" style={{ fontSize: '11px' }}>1.2 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
