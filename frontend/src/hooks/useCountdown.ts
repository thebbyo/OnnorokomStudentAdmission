import { useEffect, useState } from 'react';
import { serverNow } from '../api/client';

export interface Countdown {
  remainingMs: number;
  isExpired: boolean;
  /** Minutes and seconds left, e.g. "09:58". "--:--" when there is no expiry. */
  mmss: string;
}

function compute(expiresAt: string | undefined): Countdown {
  if (!expiresAt) return { remainingMs: 0, isExpired: false, mmss: '--:--' };
  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) return { remainingMs: 0, isExpired: false, mmss: '--:--' };
  const remainingMs = Math.max(0, target - serverNow());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    remainingMs,
    isExpired: remainingMs <= 0,
    mmss: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

/** Live countdown to `expiresAt`, measured on the server's clock so a wrong device clock can't mislead. */
export function useCountdown(expiresAt: string | undefined): Countdown {
  const [state, setState] = useState(() => compute(expiresAt));

  useEffect(() => {
    setState(compute(expiresAt));
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      const next = compute(expiresAt);
      setState((previous) =>
        previous.mmss === next.mmss && previous.isExpired === next.isExpired ? previous : next,
      );
      if (next.isExpired) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return state;
}
