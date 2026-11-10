import type { HoldStatus } from '../api/types';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';


/** Status as text plus colour plus a shape, so it never relies on colour alone. */
export function StatusBadge({ status }: { status: HoldStatus }) {
  useLocale();
  return <span className={`badge badge--${status.toLowerCase()}`}>{t(`hold.status.${status}`)}</span>;
}
