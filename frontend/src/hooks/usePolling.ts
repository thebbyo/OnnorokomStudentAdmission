import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | undefined;
  error: unknown;
  lastUpdated: number | null;
  /** True until the first response (success or failure) arrives. */
  loading: boolean;
  /** Fetch now (e.g. right after the user changed something). */
  refresh: () => Promise<void>;
}

/**
 * Calls fn now and every intervalMs. Pauses while the tab is hidden and refetches as soon as it is
 * visible or focused again. Never stacks requests: a tick is skipped while the previous call is in flight.
 * Keeps the last good data when a poll fails, so a brief outage doesn't blank the page.
 */
export function usePolling<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): PollingState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const inFlight = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const run = useCallback(async (force = false) => {
    if (inFlight.current && !force) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const myGeneration = generation.current;
    try {
      const result = await fnRef.current(controller.signal);
      if (controller.signal.aborted || myGeneration !== generation.current) return;
      setData(result);
      setError(undefined);
      setLastUpdated(Date.now());
    } catch (err) {
      if (controller.signal.aborted || myGeneration !== generation.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err);
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (myGeneration === generation.current) setSettled(true);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setData(undefined);
    setError(undefined);
    setLastUpdated(null);
    setSettled(false);
    inFlight.current?.abort();
    inFlight.current = null;

    void run();
    const timer = window.setInterval(() => {
      if (!document.hidden) void run();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      inFlight.current?.abort();
      inFlight.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  const refresh = useCallback(() => run(true), [run]);
  return { data, error, lastUpdated, loading: !settled, refresh };
}
