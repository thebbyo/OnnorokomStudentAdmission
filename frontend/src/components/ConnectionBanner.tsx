import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { useConnection } from '../hooks/useConnection';

export function ConnectionBanner() {
  useLocale();
  const online = useConnection();
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="connection-banner">
          <p>{t('banner.offline')}</p>
        </div>
      )}
    </div>
  );
}
