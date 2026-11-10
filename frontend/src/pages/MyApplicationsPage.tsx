import { Link } from 'react-router-dom';
import { friendlyError } from '../api/messages';
import type { MyHold } from '../api/types';
import { RequireStudentHint } from '../components/RequireStudentHint';
import { StatusBadge } from '../components/StatusBadge';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMyHolds } from '../hooks/useMyHolds';
import { useNow } from '../hooks/useNow';
import { liveStatus } from '../lib/holds';
import { useStudent } from '../state/StudentContext';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

export function MyApplicationsPage() {
  useLocale();
  useDocumentTitle(t('mine.title'));
  const { studentId } = useStudent();
  const holds = useMyHolds();
  useNow(1000); // re-group as held items run out

  const items = (holds.data ?? []).map((hold) => ({ ...hold, status: liveStatus(hold.status, hold.expiresAt) }));
  const active = items.filter((h) => h.status === 'HELD' || h.status === 'CONFIRMED');
  const past = items.filter((h) => h.status === 'EXPIRED' || h.status === 'CANCELLED');

  return (
    <>
      <div className="page__header">
        <div>
          <h1>{t('mine.title')}</h1>
          <p className="page__lede">{t('mine.lede')}</p>
        </div>
      </div>

      {!studentId ? (
        <div className="empty">
          <h2>{t('mine.whoIsApplying')}</h2>
          <RequireStudentHint message="mine.needStudent" />
        </div>
      ) : holds.loading ? (
        <div className="stack" aria-busy="true" aria-label="Loading applications">
          {[0, 1].map((i) => (
            <div key={i} className="card app-row" aria-hidden="true">
              <span className="skeleton skeleton--text" style={{ width: '50%' }} />
              <span className="skeleton skeleton--text" style={{ width: '30%' }} />
            </div>
          ))}
        </div>
      ) : !holds.data ? (
        <div className="notice notice--error" role="alert">
          <p className="notice__title">{t('mine.loadError')}</p>
          <p>{friendlyError(holds.error)}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h2>{t('mine.none.title')}</h2>
          <p>{t('mine.none.body')}</p>
          <Link className="btn btn-primary" to="/">
            {t('mine.browse')}
          </Link>
        </div>
      ) : (
        <div className="stack app-groups">
          <Group id="active" title={t('mine.group.active')} empty={t('mine.group.activeEmpty')} items={active} />
          <Group id="past" title={t('mine.group.past')} empty={t('mine.group.pastEmpty')} items={past} />
        </div>
      )}
    </>
  );
}

function Group({ id: key, title, empty, items }: { id: string; title: string; empty: string; items: MyHold[] }) {
  const id = `group-${key}`;
  return (
    <section aria-labelledby={id} className="app-group">
      <h2 id={id} className="app-group__title">
        {title} <span className="app-group__count tabular">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="inline-hint">{empty}</p>
      ) : (
        <ul className="app-list">
          {items.map((hold) => (
            <ApplicationRow key={hold.holdId} hold={hold} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicationRow({ hold }: { hold: MyHold }) {
  const countdown = useCountdown(hold.status === 'HELD' ? hold.expiresAt : undefined);
  return (
    <li className="card app-row">
      <div className="app-row__main">
        <p className="app-row__name">{hold.className}</p>
        <div className="app-row__meta">
          <StatusBadge status={hold.status} />
          {hold.status === 'HELD' && (
            <span className="app-row__timer tabular">
              <span>{countdown.mmss}</span> {t('mine.leftToPay')}
            </span>
          )}
        </div>
      </div>
      <Link
        className="btn btn-secondary btn-sm"
        to={`/holds/${hold.holdId}`}
        aria-label={`${hold.status === 'HELD' ? t('mine.openToPay') : t('mine.open')}: ${hold.className}`}
      >
        {hold.status === 'HELD' ? t('mine.openToPay') : t('mine.open')}
      </Link>
    </li>
  );
}
