import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setServerOffsetForTesting } from '../api/client';
import { useCountdown } from './useCountdown';

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
});

describe('useCountdown', () => {
  it('counts down in mm:ss and reports expiry at zero', () => {
    const expiresAt = iso(Date.now() + 61_000);
    const { result } = renderHook(() => useCountdown(expiresAt));
    expect(result.current.mmss).toBe('01:01');
    expect(result.current.isExpired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.mmss).toBe('00:01');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.mmss).toBe('00:00');
    expect(result.current.isExpired).toBe(true);
  });

  it("uses the server's clock, not a wrong device clock", () => {
    // Device clock is 5 minutes fast: the server is 300 s behind it.
    setServerOffsetForTesting(-300_000);
    const serverNow = Date.now() - 300_000;

    const expiresAt = iso(serverNow + 120_000);
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.isExpired).toBe(false);
    expect(result.current.mmss).toBe('02:00');
  });

  it('treats a missing expiry as not started', () => {
    const { result } = renderHook(() => useCountdown(undefined));
    expect(result.current.isExpired).toBe(false);
    expect(result.current.mmss).toBe('--:--');
  });

  it('shows hours-long holds as total minutes', () => {
    const expiresAt = iso(Date.now() + 3_600_000);
    const { result } = renderHook(() => useCountdown(expiresAt));
    expect(result.current.mmss).toBe('60:00');
  });
});
