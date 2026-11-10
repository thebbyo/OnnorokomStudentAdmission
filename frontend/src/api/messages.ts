import { ApiError } from './client';
import { t, type Key } from '../i18n';

const GENERIC_KEY = 'error.generic';

/** Every API error code, in plain language (English or Bangla, following the current locale). */
const KNOWN: Record<string, Key> = {
  SEATS_FULL: 'error.SEATS_FULL',
  ALREADY_APPLIED: 'error.ALREADY_APPLIED',
  HOLD_EXPIRED: 'error.HOLD_EXPIRED',
  HOLD_CANCELLED: 'error.HOLD_CANCELLED',
  HOLD_NOT_ACTIVE: 'error.HOLD_NOT_ACTIVE',
  FORBIDDEN: 'error.FORBIDDEN',
  INVALID_STUDENT_ID: 'error.INVALID_STUDENT_ID',
  CLASS_NOT_FOUND: 'error.CLASS_NOT_FOUND',
  HOLD_NOT_FOUND: 'error.HOLD_NOT_FOUND',
  INVALID_ID: 'error.INVALID_ID',
  NOT_FOUND: 'error.NOT_FOUND',
  SERVICE_BUSY: 'error.SERVICE_BUSY',
  NETWORK: 'error.NETWORK',
  INTERNAL: 'error.generic',
};

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) return t(GENERIC_KEY);
  // Server validation messages are English; use them only in English.
  if (error.code === 'VALIDATION_ERROR') return error.message || t('error.validation.fallback');
  const key = KNOWN[error.code];
  return key ? t(key) : t(GENERIC_KEY);
}
