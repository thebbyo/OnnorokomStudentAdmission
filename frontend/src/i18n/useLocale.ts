import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale, type Locale } from './index';

/** Re-renders the calling component whenever the language changes. Call before using t(). */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
