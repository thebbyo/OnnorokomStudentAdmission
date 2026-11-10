import { dictionary, type Key, type Locale } from './dictionary';

export type { Key, Locale };

const STORAGE_KEY = 'admission.locale';
const listeners = new Set<() => void>();

function readStored(): Locale {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

let current: Locale = readStored();

export function getLocale(): Locale {
  return current;
}

/** Changes the language everywhere (components re-render through LocaleProvider). */
export function setLocale(next: Locale): void {
  current = next === 'bn' ? 'bn' : 'en';
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'bn' ? 'bn' : 'en';
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Translates a key, filling {placeholders} from `vars`. Falls back to English, then to the key itself. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const raw = dictionary[current][key] ?? dictionary.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
