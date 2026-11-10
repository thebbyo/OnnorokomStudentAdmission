import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { StudentProvider } from '../state/StudentContext';

export const STUDENT = '20152691234567890';

export interface FakeRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export type FakeResponse = Response | 'network-error';

export function json(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Replaces fetch with a tiny fake server. The handler sees method, path, headers and parsed body. */
export function mockServer(handler: (req: FakeRequest) => FakeResponse | Promise<FakeResponse>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const request: FakeRequest = {
      method: init?.method ?? 'GET',
      path: new URL(url).pathname,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    const response = await handler(request);
    if (response === 'network-error') throw new TypeError('Failed to fetch');
    return response;
  });
  window.__CONFIG__ = { API_BASE_URL: 'http://api.test' };
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** Renders the real routes at `path`, with an optional saved student id. */
export function renderApp(path: string, options: { studentId?: string } = {}) {
  if (options.studentId) localStorage.setItem('admission.studentId', options.studentId);
  return render(
    <StudentProvider>
      <MemoryRouter initialEntries={[path]}>
        <ConnectionBanner />
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </StudentProvider>,
  );
}

export function classStats(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c_1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 120,
    heldSeats: 15,
    confirmedSeats: 80,
    availableSeats: 25,
    ...overrides,
  };
}
