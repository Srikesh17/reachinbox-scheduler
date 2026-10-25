import type {
  User,
  EmailItem,
  EmailStats,
  ScheduleRequest,
  ScheduleResponse,
} from '../types/email.js';

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const data = await request<{ user: User | null }>('/api/auth/me');
  return data.user;
}

export async function loginDemoUser(): Promise<User> {
  const data = await request<{ user: User }>('/api/auth/demo', {
    method: 'POST',
  });
  return data.user;
}

export async function loginEmailUser(
  email: string,
  password?: string
): Promise<User> {
  const data = await request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function logoutUser(): Promise<void> {
  await request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function fetchScheduledEmails(): Promise<EmailItem[]> {
  const data = await request<{ emails: EmailItem[] }>('/api/emails/scheduled');
  return data.emails;
}

export async function fetchSentEmails(): Promise<EmailItem[]> {
  const data = await request<{ emails: EmailItem[] }>('/api/emails/sent');
  return data.emails;
}

export async function fetchEmailStats(): Promise<EmailStats> {
  return await request<EmailStats>('/api/emails/stats');
}

export async function fetchEmailDetail(id: string): Promise<EmailItem> {
  const data = await request<{ email: EmailItem }>(`/api/emails/${id}`);
  return data.email;
}

export async function scheduleEmails(
  payload: ScheduleRequest
): Promise<ScheduleResponse> {
  return await request<ScheduleResponse>('/api/emails/schedule', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
