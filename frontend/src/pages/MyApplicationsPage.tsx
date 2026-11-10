import { Link } from 'react-router-dom';
import { friendlyError } from '../api/messages';
import type { MyHold } from '../api/types';
import { RequireStudentHint } from '../components/RequireStudentHint';
import { StatusBadge } from '../components/StatusBadge';
import { useCountdown } from '../hooks/useCountdown';
import { useMyHolds } from '../hooks/useMyHolds';
import { useNow } from '../hooks/useNow';
import { liveStatus } from '../lib/holds';
import { useStudent } from '../state/StudentContext';

export function MyApplicationsPage() {
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
          <h1>My applications</h1>
          <p className="page__lede">Every application for this student, newest first.</p>
        </div>
      </div>

      {!studentId ? (
        <div className="empty">
          <h2>Who is applying?</h2>
          <RequireStudentHint action="see applications" />
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
          <p className="notice__title">Your applications could not be loaded.</p>
          <p>{friendlyError(holds.error)}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h2>No applications yet.</h2>
          <p>Apply for a class to hold a seat. You then have a few minutes to pay the admission fee.</p>
          <Link className="btn btn-primary" to="/">
            Browse classes
          </Link>
        </div>
      ) : (
        <div className="stack app-groups">
          <Group title="Active" empty="No active applications. Held seats and confirmed admissions appear here." items={active} />
          <Group title="Past" empty="Nothing here yet." items={past} />
        </div>
      )}
    </>
  );
}

function Group({ title, empty, items }: { title: string; empty: string; items: MyHold[] }) {
  const id = `group-${title.toLowerCase()}`;
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
              <span>{countdown.mmss}</span> left to pay
            </span>
          )}
        </div>
      </div>
      <Link
        className="btn btn-secondary btn-sm"
        to={`/holds/${hold.holdId}`}
        aria-label={`${hold.status === 'HELD' ? 'Open to pay' : 'Open'}: ${hold.className}`}
      >
        {hold.status === 'HELD' ? 'Open to pay' : 'Open'}
      </Link>
    </li>
  );
}
