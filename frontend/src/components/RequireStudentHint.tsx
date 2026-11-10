import { t, type Key } from '../i18n';
import { useLocale } from '../i18n/useLocale';

/** Inline hint shown instead of a surprise error when an action needs the student's id. */
export function RequireStudentHint({ message }: { message: Key }) {
  useLocale();
  return (
    <p className="inline-hint" role="note">
      {t(message)}
    </p>
  );
}
