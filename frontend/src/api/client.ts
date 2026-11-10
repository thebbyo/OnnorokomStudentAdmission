import { apiBaseUrl } from '../config';

/** A failed API call. code is the server's error code, or NETWORK when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message || code);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  studentId?: string | null;
  signal?: AbortSignal;
}

// ---- Server clock -------------------------------------------------------
// Countdowns use the server's clock (from the Date header), so a phone with a wrong clock
// can't show an expired hold as active, or the other way round.
let serverOffsetMs = 0;
let hasOffset = false;

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

function trackServerClock(dateHeader: string | null) {
  if (!dateHeader) return;
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs)) return;
  // The header has 1-second resolution: assume the middle of that second.
  const estimate = serverMs + 500 - Date.now();
  // Ignore sub-second jitter so countdowns don't jump on every poll.
  if (!hasOffset || Math.abs(estimate - serverOffsetMs) > 1000) {
    serverOffsetMs = estimate;
    hasOffset = true;
  }
}

// ---- Connection state ---------------------------------------------------
type ConnectionListener = (online: boolean) => void;
const listeners = new Set<ConnectionListener>();
let online = true;

export function isOnline(): boolean {
  return online;
}

export function subscribeConnection(listener: ConnectionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setOnline(value: boolean) {
  if (online === value) return;
  online = value;
  listeners.forEach((listener) => listener(value));
}

/** Test helper: forget clock offset and connection state. */
export function resetClientState() {
  serverOffsetMs = 0;
  hasOffset = false;
  online = true;
  listeners.clear();
}

// ---- Request ------------------------------------------------------------
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.studentId) headers['X-Student-Id'] = options.studentId;

  let response: Response;
  try {
    response = await fetch(apiBaseUrl() + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    setOnline(false);
    throw new ApiError('NETWORK', 0, 'Could not reach the server.');
  }

  setOnline(true);
  trackServerClock(response.headers.get('Date'));

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: unknown; message?: unknown };
    const code = typeof body.error === 'string' ? body.error : response.status >= 500 ? 'INTERNAL' : 'UNKNOWN';
    const message = typeof body.message === 'string' ? body.message : '';
    throw new ApiError(code, response.status, message);
  }
  return data as T;
}
