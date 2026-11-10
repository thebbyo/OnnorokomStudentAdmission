import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { friendlyError } from './messages';

const cases: Array<[string, string]> = [
  ['SEATS_FULL', 'All seats in this class are taken. Try another class or shift.'],
  ['ALREADY_APPLIED', 'You already have an active application or admission in this class. Check My applications.'],
  ['HOLD_EXPIRED', 'Your seat hold has expired and the seat was released. Apply again if seats are still available.'],
  ['HOLD_CANCELLED', 'This application was cancelled. Apply again if seats are still available.'],
  ['HOLD_NOT_ACTIVE', 'This application can no longer be cancelled.'],
  ['FORBIDDEN', 'This application belongs to a different student. Check the birth registration number at the top of the page.'],
  ['INVALID_STUDENT_ID', "Enter the student's 17-digit birth registration number at the top of the page."],
  ['CLASS_NOT_FOUND', 'This class no longer exists. Go back to the class list.'],
  ['HOLD_NOT_FOUND', "We couldn't find this application. Open it from My applications."],
  ['SERVICE_BUSY', 'The admission server is very busy right now. Please try again in a few seconds.'],
  ['NETWORK', "Can't reach the admission server. Check your connection; we'll keep retrying."],
];

describe('friendlyError', () => {
  it.each(cases)('maps %s to plain language', (code, text) => {
    expect(friendlyError(new ApiError(code, 409, 'server text'))).toBe(text);
  });

  it('shows the server message for VALIDATION_ERROR', () => {
    expect(friendlyError(new ApiError('VALIDATION_ERROR', 400, '"name" must not be empty.'))).toBe(
      '"name" must not be empty.',
    );
  });

  it('falls back for unknown codes', () => {
    expect(friendlyError(new ApiError('SOMETHING_NEW', 418, 'x'))).toBe('Something went wrong on our side. Please try again.');
  });

  it('falls back for non-API errors', () => {
    expect(friendlyError(new Error('boom'))).toBe('Something went wrong on our side. Please try again.');
    expect(friendlyError('weird')).toBe('Something went wrong on our side. Please try again.');
  });
});
