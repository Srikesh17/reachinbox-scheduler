import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  Calendar,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  Quote,
  Code,
} from 'lucide-react';
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

    if (preset === '10s') {
      target = new Date(Date.now() + 10 * 1000);
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

  const handleSubmit = async (e?: FormEvent) => {
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

    const chosenDate = new Date(scheduledDateStr);
    if (Number.isNaN(chosenDate.getTime())) {
      onError('Invalid scheduled date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await scheduleEmails({
        subject: subject.trim(),
        body: body.trim(),
        recipients: combinedRecipients,
        startAt: chosenDate.toISOString(),
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
    <div className="compose-full-page-view">
      <div className="compose-top-nav-bar">
        <div className="compose-title-left">
          <button
            type="button"
            onClick={onClose}
            className="compose-back-arrow-btn"
            title="Back to inbox"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="compose-main-title">Compose New Email</h2>
        </div>

        <div className="compose-top-actions-right">
          <button
            type="button"
            className="compose-action-icon-btn with-badge"
            title="Attachments"
          >
            <Paperclip size={17} />
            <span className="icon-tiny-badge">1</span>
          </button>

          <button
            type="button"
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className="compose-action-icon-btn"
            title="Schedule time"
          >
            <Clock size={17} />
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="compose-send-later-pill-btn"
          >
            {isSubmitting ? 'Scheduling...' : 'Send Later'}
          </button>

          {sendLaterOpen && (
            <div className="send-later-popover-box" ref={sendLaterRef}>
              <h4 className="popover-title">Send Later</h4>

              <div className="popover-date-input-row">
                <input
                  type="datetime-local"
                  value={scheduledDateStr}
                  onChange={(e) => setScheduledDateStr(e.target.value)}
                  className="popover-datetime-field"
                />
                <Calendar size={15} className="popover-calendar-icon" />
              </div>

              <div className="popover-presets-list">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('10s')}
                  className="popover-preset-item highlight-quick"
                >
                  ⚡ Send in 10 seconds (Quick Test)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow')}
                  className="popover-preset-item"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-10')}
                  className="popover-preset-item"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-11')}
                  className="popover-preset-item"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('tomorrow-3pm')}
                  className="popover-preset-item"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              <div className="popover-footer-actions">
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="popover-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="popover-done-btn"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="compose-fields-card">
        <div className="compose-field-row">
          <label className="compose-field-label">From</label>
          <div className="from-dropdown-container">
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="from-select-element"
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

        <div className="compose-field-row recipients-row">
          <label className="compose-field-label">To</label>
          <div className="recipients-chips-input-area">
            {visibleChips.map((chip, idx) => (
              <span key={chip} className="green-recipient-chip">
                <span>{chip}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="chip-remove-btn"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {remainingCount > 0 && (
              <span className="green-recipient-count-chip">
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
              className="recipients-inline-input"
            />
          </div>

          <div className="upload-list-btn-wrapper">
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
              className="upload-list-trigger-btn"
            >
              <Upload size={14} />
              <span>Upload List</span>
            </button>
          </div>
        </div>

        <div className="compose-field-row">
          <label className="compose-field-label">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="compose-subject-input"
          />
        </div>

        <div className="compose-field-row limits-delay-row">
          <div className="limits-subgroup">
            <label className="compose-field-label">
              Delay between 2 emails
            </label>
            <input
              type="number"
              min="0"
              max="600"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Math.min(600, Math.max(0, Number(e.target.value))))}
              className="small-number-box-input"
            />
            <span className="unit-label-text">sec (max 10m)</span>
          </div>

          <div className="limits-subgroup">
            <label className="compose-field-label">Hourly Limit</label>
            <input
              type="number"
              min="1"
              max="100"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="small-number-box-input"
            />
            <span className="unit-label-text">/ hr (max 100)</span>
          </div>
        </div>

        <div className="compose-editor-box">
          <div className="editor-formatting-toolbar">
            <button type="button" className="toolbar-btn" title="Undo">
              <Undo2 size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="Redo">
              <Redo2 size={14} />
            </button>
            <span className="toolbar-divider" />
            <button
              type="button"
              className="toolbar-btn text-bold"
              title="Font"
            >
              Tt
            </button>
            <button type="button" className="toolbar-btn" title="Bold">
              <Bold size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="Italic">
              <Italic size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="Underline">
              <Underline size={14} />
            </button>
            <span className="toolbar-divider" />
            <button type="button" className="toolbar-btn" title="Align">
              <AlignLeft size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="List">
              <List size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="Quote">
              <Quote size={14} />
            </button>
            <button type="button" className="toolbar-btn" title="Code">
              <Code size={14} />
            </button>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            rows={12}
            className="compose-body-textarea"
          />
        </div>
      </div>
    </div>
  );
}
