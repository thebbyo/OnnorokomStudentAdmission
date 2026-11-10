import { serverNow } from '../api/client';
import type { HoldStatus, MyHold } from '../api/types';

/** HELD whose expiry has passed (by the server's clock) is EXPIRED, even before the server says so. */
export function liveStatus(status: HoldStatus, expiresAt: string, now = serverNow()): HoldStatus {
  return status === 'HELD' && Date.parse(expiresAt) <= now ? 'EXPIRED' : status;
}

/** The student's active (HELD or CONFIRMED) application for each class. */
export function activeHoldsByClass(holds: MyHold[] | undefined, now = serverNow()): Map<string, MyHold> {
  const map = new Map<string, MyHold>();
  for (const hold of holds ?? []) {
    const status = liveStatus(hold.status, hold.expiresAt, now);
    if (status === 'HELD' || status === 'CONFIRMED') map.set(hold.classId, { ...hold, status });
  }
  return map;
}
