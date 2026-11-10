import { useSyncExternalStore } from 'react';
import { isOnline, subscribeConnection } from '../api/client';

/** False after a request failed to reach the server; true again after any response. */
export function useConnection(): boolean {
  return useSyncExternalStore(subscribeConnection, isOnline, () => true);
}
