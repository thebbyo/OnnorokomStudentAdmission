import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetClientState } from '../api/client';
import { setLocale } from '../i18n';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetClientState();
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
