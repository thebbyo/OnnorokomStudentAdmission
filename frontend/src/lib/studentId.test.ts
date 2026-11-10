import { describe, expect, it } from 'vitest';
import { isValidStudentId, sanitizeStudentIdInput } from './studentId';

describe('isValidStudentId', () => {
  it('accepts exactly 17 ASCII digits', () => {
    expect(isValidStudentId('20152691234567890')).toBe(true);
    expect(isValidStudentId('00000000000000000')).toBe(true);
  });

  it.each(['', '2015269123456789', '201526912345678901', '2015269123456789a', '2015 2691234567890', '２０１５２６９１２３４５６７８９０'])(
    'rejects %j',
    (value) => {
      expect(isValidStudentId(value)).toBe(false);
    },
  );
});

describe('sanitizeStudentIdInput', () => {
  it('keeps ASCII digits only and caps at 17', () => {
    expect(sanitizeStudentIdInput('2015-269 1234567890xyz')).toBe('20152691234567890');
    expect(sanitizeStudentIdInput('123456789012345678999')).toBe('12345678901234567');
  });

  it('drops full-width digits rather than guessing', () => {
    expect(sanitizeStudentIdInput('１２3')).toBe('3');
  });
});
