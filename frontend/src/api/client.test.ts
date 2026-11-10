import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, resetClientState, serverNow, subscribeConnection } from './client';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('apiRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetClientState();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.__CONFIG__ = { API_BASE_URL: 'http://api.test/' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('calls the configured base URL without a double slash', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiRequest('/classes');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/classes');
  });

  it('rejects with the API error code on 409', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'SEATS_FULL', message: 'full' }));
    await expect(apiRequest('/classes/c_1/holds', { method: 'POST' })).rejects.toMatchObject({
      code: 'SEATS_FULL',
      status: 409,
    });
  });

  it('turns a network failure into NETWORK and marks the app offline', async () => {
    const seen: boolean[] = [];
    subscribeConnection((online) => seen.push(online));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiRequest('/classes').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'NETWORK', status: 0 });
    expect(seen).toEqual([false]);

    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiRequest('/classes');
    expect(seen).toEqual([false, true]);
  });

  it('maps a non-JSON 502 to INTERNAL', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(apiRequest('/classes')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  it('tracks the server clock from the Date header', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00.000Z'));
    fetchMock.mockResolvedValue(jsonResponse(200, [], { Date: 'Tue, 10 Nov 2026 10:05:00 GMT' }));

    await apiRequest('/classes');

    const offset = serverNow() - Date.now();
    expect(offset).toBeGreaterThanOrEqual(300_000);
    expect(offset).toBeLessThanOrEqual(301_000);
  });

  it('sends the student id header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiRequest('/me/holds', { studentId: '20152691234567890' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Student-Id']).toBe('20152691234567890');
  });

  it('sends JSON bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'c_1' }));
    await apiRequest('/classes', { method: 'POST', body: { name: 'A', totalSeats: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"name":"A","totalSeats":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('resolves 204 to undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest('/holds/h_1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
