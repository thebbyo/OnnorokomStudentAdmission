import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` and returns Date.now(). For "updated Xs ago" style labels. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
