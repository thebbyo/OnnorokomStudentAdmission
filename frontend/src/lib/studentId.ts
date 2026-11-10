export const STUDENT_ID_LENGTH = 17;

/** A birth registration number: exactly 17 ASCII digits (leading zeros allowed). */
export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value);
}

/** Keep ASCII digits only (spaces, dashes and letters are dropped), capped at 17. */
export function sanitizeStudentIdInput(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, STUDENT_ID_LENGTH);
}
