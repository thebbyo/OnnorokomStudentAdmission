import { ApiError } from './client';

const GENERIC = 'Something went wrong on our side. Please try again.';

/** Every API error code, in plain language: what happened, and what to do next. */
const MESSAGES: Record<string, string> = {
  SEATS_FULL: 'All seats in this class are taken. Try another class or shift.',
  ALREADY_APPLIED: 'You already have an active application or admission in this class. Check My applications.',
  HOLD_EXPIRED: 'Your seat hold has expired and the seat was released. Apply again if seats are still available.',
  HOLD_CANCELLED: 'This application was cancelled. Apply again if seats are still available.',
  HOLD_NOT_ACTIVE: 'This application can no longer be cancelled.',
  FORBIDDEN:
    'This application belongs to a different student. Check the birth registration number at the top of the page.',
  INVALID_STUDENT_ID: "Enter the student's 17-digit birth registration number at the top of the page.",
  CLASS_NOT_FOUND: 'This class no longer exists. Go back to the class list.',
  HOLD_NOT_FOUND: "We couldn't find this application. Open it from My applications.",
  INVALID_ID: "That link doesn't look right. Go back to the class list.",
  NOT_FOUND: "That page doesn't exist on the server. Go back to the class list.",
  SERVICE_BUSY: 'The admission server is very busy right now. Please try again in a few seconds.',
  NETWORK: "Can't reach the admission server. Check your connection; we'll keep retrying.",
  INTERNAL: GENERIC,
};

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC;
  if (error.code === 'VALIDATION_ERROR') return error.message || 'Please check what you entered and try again.';
  return MESSAGES[error.code] ?? GENERIC;
}
