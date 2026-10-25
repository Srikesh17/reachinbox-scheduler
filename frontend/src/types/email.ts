export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface EmailItem {
  id: string;
  user_email: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: EmailStatus;
  delay_seconds: number;
  hourly_limit: number;
  failure_reason?: string | null;
  message_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  sender?: string;
}

export interface ScheduleResponse {
  message: string;
  count: number;
  emails: EmailItem[];
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
}
