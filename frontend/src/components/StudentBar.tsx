import { useEffect, useRef, useState, type FormEvent } from 'react';
import { STUDENT_ID_LENGTH, isValidStudentId, sanitizeStudentIdInput } from '../lib/studentId';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { useStudent } from '../state/StudentContext';

export function StudentBar() {
  useLocale();
  const { studentId, setStudentId, clearStudentId } = useStudent();
  const [draft, setDraft] = useState('');
  const [focusRequested, setFocusRequested] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusRequested && !studentId) {
      inputRef.current?.focus();
      setFocusRequested(false);
    }
  }, [focusRequested, studentId]);

  if (studentId) {
    return (
      <div className="student-bar student-bar--set">
        <p className="student-bar__current">
          <span className="student-bar__label">{t('student.label')}</span>
          <span className="student-bar__id">{studentId}</span>
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setDraft('');
            clearStudentId();
            setFocusRequested(true);
          }}
        >
          {t('student.change')}
        </button>
      </div>
    );
  }

  const valid = isValidStudentId(draft);
  const remaining = STUDENT_ID_LENGTH - draft.length;
  const hint =
    draft.length === 0
      ? t('student.hint.empty')
      : valid
        ? t('student.hint.complete')
        : t('student.hint.more', { count: remaining });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) setStudentId(draft);
  };

  return (
    <form className="student-bar" onSubmit={onSubmit} noValidate>
      <label className="student-bar__field-label" htmlFor="student-id">
        {t('student.field')}
      </label>
      <div className="student-bar__row">
        <div className="student-bar__input-wrap">
          <input
            ref={inputRef}
            id="student-id"
            className="input student-bar__input"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(sanitizeStudentIdInput(event.target.value))}
            aria-describedby="student-id-hint"
            aria-invalid={draft.length > 0 && !valid ? true : undefined}
          />
          <span className="student-bar__count" aria-hidden="true">
            {draft.length}/{STUDENT_ID_LENGTH}
          </span>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {t('student.save')}
        </button>
      </div>
      <p id="student-id-hint" className="student-bar__hint">
        {hint}
      </p>
    </form>
  );
}
