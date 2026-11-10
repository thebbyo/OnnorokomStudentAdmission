import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

let hidden = false;

beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.useFakeTimers();
});

afterEach(() => {
  // @ts-expect-error restore jsdom's own getter
  delete document.hidden;
});

const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});

describe('usePolling', () => {
  it('fetches immediately, then every interval', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() => usePolling(fn, 3000));
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe(42);
    expect(result.current.lastUpdated).not.toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(fn).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('pauses while the tab is hidden and refetches as soon as it is visible', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    renderHook(() => usePolling(fn, 3000));
    await flush();

    hidden = true;
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(fn).toHaveBeenCalledTimes(1);

    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('keeps the last data when a later poll fails', async () => {
    const fn = vi.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => usePolling(fn, 3000));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(result.current.data).toBe('first');
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('does not stack requests while one is still in flight', async () => {
    let resolve: (value: string) => void = () => {};
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    renderHook(() => usePolling(fn, 1000));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => resolve('done'));
  });

  it('starts over when deps change', async () => {
    const fn = vi.fn().mockResolvedValue('x');
    const { rerender } = renderHook(({ id }) => usePolling(fn, 3000, [id]), { initialProps: { id: 'a' } });
    await flush();
    rerender({ id: 'b' });
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
