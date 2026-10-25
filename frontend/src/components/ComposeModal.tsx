import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { scheduleEmails } from '../lib/api.js';
import type { User } from '../types/email.js';

interface ComposeModalProps {
  currentUser: User;
  onClose: () => void;
  onScheduled: (count: number) => void;
  onError: (msg: string) => void;
}

export function ComposeModal({
  currentUser,
  onClose,
  onScheduled,
  onError,
}: ComposeModalProps) {
  const [sender, setSender] = useState(
    currentUser.email || 'oliver.brown@domain.io'
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledDateStr, setScheduledDateStr] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 1000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendLaterRef = useRef<HTMLDivElement>(null);

  const parseEmailsFromString = (text: string): string[] => {
    const matches =
      text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map((e) => e.trim().toLowerCase()))];
  };

  const handleRecipientsKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const detected = parseEmailsFromString(recipientsInput);
      if (detected.length > 0) {
        setRecipientsList((prev) => [
          ...new Set([...prev, ...detected]),
        ]);
        setRecipientsInput('');
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const parsed = parseEmailsFromString(content);
      if (parsed.length > 0) {
        setRecipientsList((prev) => [
          ...new Set([...prev, ...parsed]),
        ]);
      } else {
        onError('No valid email addresses found in the uploaded file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipientsList((prev) =>
      prev.filter((_, idx) => idx !== indexToRemove)
    );
  };

  const handlePresetSelect = (preset: string) => {
    const now = new Date();
    let target = new Date();

    if (preset === 'now') {
      target = new Date();
    } else if (preset === '10s') {
      target = new Date(Date.now() + 10 * 1000);
    } else if (preset === '1m') {
      target = new Date(Date.now() + 60 * 1000);
    } else if (preset === '5m') {
      target = new Date(Date.now() + 5 * 60 * 1000);
    } else if (preset === 'tomorrow') {
      target.setDate(now.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow-10') {
      target.setDate(now.getDate() + 1);
      target.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow-11') {
      target.setDate(now.getDate() + 1);
      target.setHours(11, 0, 0, 0);
    } else if (preset === 'tomorrow-3pm') {
      target.setDate(now.getDate() + 1);
      target.setHours(15, 0, 0, 0);
    }

    const localIso = new Date(
      target.getTime() - target.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);
    setScheduledDateStr(localIso);
  };

  const handleSubmit = async (e?: FormEvent, overrideStartAt?: string) => {
    if (e) e.preventDefault();
    onError('');

    const currentTyped = parseEmailsFromString(recipientsInput);
    const combinedRecipients = [
      ...new Set([...recipientsList, ...currentTyped]),
    ];

    if (!subject.trim()) {
      onError('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      onError('Email body text is required.');
      return;
    }
    if (combinedRecipients.length === 0) {
      onError(
        'Please add at least one recipient email address or upload a list.'
      );
      return;
    }

    let finalStartAt = overrideStartAt;
    if (!finalStartAt) {
      const chosenDate = new Date(scheduledDateStr);
      if (Number.isNaN(chosenDate.getTime())) {
        onError('Invalid scheduled date and time.');
        return;
      }

      finalStartAt =
        chosenDate.getTime() <= Date.now() + 5000
          ? new Date().toISOString()
          : chosenDate.toISOString();
    }

    setIsSubmitting(true);
    try {
      const response = await scheduleEmails({
        subject: subject.trim(),
        body: body.trim(),
        recipients: combinedRecipients,
        startAt: finalStartAt,
        delaySeconds,
        hourlyLimit,
        sender,
      });

      onScheduled(response.count);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Scheduling failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleChips = recipientsList.slice(0, 3);
  const remainingCount = recipientsList.length - visibleChips.length;

  return (
    <div className="compose-full-page-view d-flex flex-column flex-grow-1">
      <div className="compose-top-nav-bar d-flex align-items-center justify-content-between p-3 border-bottom">
        <div className="compose-title-left d-flex align-items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="compose-back-arrow-btn border-0 bg-transparent text-secondary p-1"
            title="Back to inbox"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h5 className="compose-main-title mb-0 fw-bold text-dark">Compose New Email</h5>
        </div>

        <div className="compose-top-actions-right position-relative d-flex align-items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="compose-action-icon-btn with-badge position-relative border-0 bg-transparent text-secondary p-2"
            title="Upload Files (CSV or TXT)"
          >
            <i className="fa-solid fa-paperclip"></i>
            <span className="icon-tiny-badge">
              {uploadedFileName ? '1' : '+'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className="compose-action-icon-btn border-0 bg-transparent text-secondary p-2"
            title="Schedule time"
          >
            <i className="fa-regular fa-clock"></i>
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit(undefined, new Date().toISOString())}
            disabled={isSubmitting}
            className="btn btn-sm btn-outline-success rounded-pill px-3 py-1 fw-semibold"
            title="Send immediately"
          >
            Send Now
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="compose-send-later-pill-btn rounded-pill px-3 py-1 fw-semibold"
            title="Schedule for selected time"
          >
            {isSubmitting ? 'Scheduling...' : 'Send Later'}
          </button>

          {sendLaterOpen && (
            <div className="send-later-popover-box position-absolute bg-white border rounded shadow p-3 z-3" ref={sendLaterRef}>
              <h6 className="popover-title fw-bold text-dark mb-2">Send Later</h6>

              <div className="popover-date-input-row d-flex align-items-center border rounded p-2 mb-3">
                <input
                  type="datetime-local"
                  value={scheduledDateStr}
                  onChange={(e) => setScheduledDateStr(e.target.value)}
                  className="popover-datetime-field border-0 flex-grow-1 small"
                />
                <i className="fa-regular fa-calendar text-muted ms-2"></i>
              </div>

              <div className="popover-presets-list d-flex flex-column gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setSendLaterOpen(false);
                    void handleSubmit(undefined, new Date().toISOString());
                  }}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-success fw-semibold"
                >
                  ⚡ Send Now (Immediately)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePresetSelect('10s');
                    setSendLaterOpen(false);
                  }}
                  className="popover-preset-item highlight-quick border-0 text-start p-2 rounded small"
                >
                  ⚡ Send in 10 seconds (Quick Test)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePresetSelect('1m');
                    setSendLaterOpen(false);
                  }}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Send in 1 minute
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePresetSelect('5m');
                    setSendLaterOpen(false);
                  }}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Send in 5 minutes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePresetSelect('tomorrow');
                    setSendLaterOpen(false);
                  }}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-10')}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-11')}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-3pm')}
                  className="popover-preset-item border-0 text-start p-2 rounded small text-secondary"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              <div className="popover-footer-actions d-flex align-items-center justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="popover-cancel-btn border-0 bg-transparent text-secondary small px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="popover-done-btn btn btn-outline-success btn-sm rounded-pill px-3"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="compose-fields-card p-4 d-flex flex-column gap-3">
        <div className="compose-field-row d-flex align-items-center border-bottom pb-2">
          <label className="compose-field-label text-muted small fw-semibold">From</label>
          <div className="from-dropdown-container flex-grow-1">
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="from-select-element border-0 fw-semibold text-dark small bg-transparent cursor-pointer"
            >
              <option value={currentUser.email || 'oliver.brown@domain.io'}>
                {currentUser.email || 'oliver.brown@domain.io'}
              </option>
              <option value="outreach@reachinbox.ai">
                outreach@reachinbox.ai
              </option>
              <option value="growth@reachinbox.ai">
                growth@reachinbox.ai
              </option>
            </select>
          </div>
        </div>

        <div className="compose-field-row recipients-row d-flex align-items-center border-bottom pb-2">
          <label className="compose-field-label text-muted small fw-semibold">To</label>
          <div className="recipients-chips-input-area d-flex align-items-center flex-wrap gap-1 flex-grow-1">
            {visibleChips.map((chip, idx) => (
              <span key={chip} className="green-recipient-chip badge d-inline-flex align-items-center gap-1 rounded-pill fw-normal">
                <span>{chip}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="chip-remove-btn border-0 bg-transparent p-0 text-success"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            ))}

            {remainingCount > 0 && (
              <span className="green-recipient-count-chip badge rounded-pill fw-bold">
                +{remainingCount}
              </span>
            )}

            <input
              type="text"
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              onKeyDown={handleRecipientsKeyDown}
              placeholder={
                recipientsList.length === 0
                  ? 'recipient@example.com (press Enter or comma)'
                  : 'Add more...'
              }
              className="recipients-inline-input border-0 flex-grow-1 small"
            />
          </div>

          <div className="upload-list-btn-wrapper ms-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline-success btn-sm rounded-pill d-inline-flex align-items-center gap-1 px-3 py-1 fw-semibold text-nowrap"
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {uploadedFileName && (
          <div className="uploaded-file-banner d-inline-flex align-items-center gap-2 px-3 py-1 bg-success-subtle border border-success rounded-pill small text-success align-self-start">
            <i className="fa-solid fa-file-csv"></i>
            <span className="fw-semibold">
              {uploadedFileName} ({recipientsList.length} recipients imported)
            </span>
            <button
              type="button"
              onClick={() => {
                setUploadedFileName(null);
                setRecipientsList([]);
              }}
              className="border-0 bg-transparent text-danger p-0 ms-1 fw-bold"
              title="Remove uploaded file"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        <div className="compose-field-row d-flex align-items-center border-bottom pb-2">
          <label className="compose-field-label text-muted small fw-semibold">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="compose-subject-input border-0 flex-grow-1 small"
          />
        </div>

        <div className="compose-field-row limits-delay-row d-flex align-items-center gap-4">
          <div className="limits-subgroup d-flex align-items-center gap-2">
            <label className="compose-field-label text-muted small fw-semibold mb-0" style={{ width: 'auto' }}>
              Delay between 2 emails
            </label>
            <input
              type="number"
              min="0"
              max="600"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Math.min(600, Math.max(0, Number(e.target.value))))}
              className="small-number-box-input form-control form-control-sm text-center fw-bold"
              style={{ width: 64 }}
            />
            <span className="unit-label-text text-muted small">sec (max 10m)</span>
          </div>

          <div className="limits-subgroup d-flex align-items-center gap-2">
            <label className="compose-field-label text-muted small fw-semibold mb-0" style={{ width: 'auto' }}>Hourly Limit</label>
            <input
              type="number"
              min="1"
              max="100"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="small-number-box-input form-control form-control-sm text-center fw-bold"
              style={{ width: 64 }}
            />
            <span className="unit-label-text text-muted small">/ hr (max 100)</span>
          </div>
        </div>

        <div className="compose-editor-box border rounded overflow-hidden">
          <div className="editor-formatting-toolbar d-flex align-items-center gap-2 p-2 border-bottom bg-white">
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Undo">
              <i className="fa-solid fa-rotate-left"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Redo">
              <i className="fa-solid fa-rotate-right"></i>
            </button>
            <span className="toolbar-divider" />
            <button
              type="button"
              className="toolbar-btn border-0 bg-transparent text-secondary p-1 fw-bold"
              title="Font"
            >
              Tt
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Bold">
              <i className="fa-solid fa-bold"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Italic">
              <i className="fa-solid fa-italic"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Underline">
              <i className="fa-solid fa-underline"></i>
            </button>
            <span className="toolbar-divider" />
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Align">
              <i className="fa-solid fa-align-left"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="List">
              <i className="fa-solid fa-list-ul"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Quote">
              <i className="fa-solid fa-quote-left"></i>
            </button>
            <button type="button" className="toolbar-btn border-0 bg-transparent text-secondary p-1" title="Code">
              <i className="fa-solid fa-code"></i>
            </button>
            <div className="ms-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 small text-dark rounded-pill px-3"
                title="Upload file or recipient list"
              >
                <i className="fa-solid fa-paperclip text-success"></i>
                <span>Upload File</span>
              </button>
            </div>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            rows={12}
            className="compose-body-textarea form-control border-0 p-3"
          />
        </div>
      </div>
    </div>
  );
}
