import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { createHold, listClasses } from '../api/endpoints';
import { friendlyError } from '../api/messages';
import type { ClassStats, MyHold } from '../api/types';
import { RequireStudentHint } from '../components/RequireStudentHint';
import { SeatBar } from '../components/SeatBar';
import { SkeletonCard } from '../components/Skeleton';
import { useConnection } from '../hooks/useConnection';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMyHolds } from '../hooks/useMyHolds';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { activeHoldsByClass } from '../lib/holds';
import { useStudent } from '../state/StudentContext';

const number = new Intl.NumberFormat('en-US');

export function ClassListPage() {
  useDocumentTitle('Classes');
  const classes = usePolling(listClasses, 3000);
  const myHolds = useMyHolds();
  const { studentId } = useStudent();
  const online = useConnection();
  const now = useNow(1000);
  const announcement = useAvailabilityAnnouncement(classes.data);
  const active = activeHoldsByClass(myHolds.data);

  const secondsAgo = classes.lastUpdated ? Math.max(0, Math.round((now - classes.lastUpdated) / 1000)) : null;
  const freshness = !online ? 'Reconnecting…' : secondsAgo === null ? '' : secondsAgo < 2 ? 'Updated just now' : `Updated ${secondsAgo}s ago`;

  return (
    <>
      <div className="page__header">
        <div>
          <h1>Classes open for admission</h1>
          <p className="page__lede">First come, first served. Seats update every few seconds.</p>
        </div>
        <p className="freshness tabular" aria-hidden={online ? 'true' : undefined}>
          {freshness}
        </p>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {!studentId && classes.data && classes.data.length > 0 && (
        <div className="notice notice--info page__notice">
          <RequireStudentHint action="apply" />
        </div>
      )}

      {classes.loading ? (
        <div className="class-grid" data-testid="classes-loading" aria-busy="true" aria-label="Loading classes">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !classes.data ? (
        <div className="notice notice--error" role="alert">
          <p className="notice__title">The class list could not be loaded.</p>
          <p>{friendlyError(classes.error)}</p>
        </div>
      ) : classes.data.length === 0 ? (
        <div className="empty">
          <h2>No classes are open for admission yet.</h2>
          <p>The school admin adds classes and their seat counts. They will appear here automatically.</p>
          <Link className="btn btn-secondary" to="/admin">
            Create a class (school admin)
          </Link>
        </div>
      ) : (
        <div className="class-grid">
          {classes.data.map((item) => (
            <ClassCard
              key={item.id}
              item={item}
              activeHold={active.get(item.id)}
              studentId={studentId}
              onChanged={() => {
                void classes.refresh();
                void myHolds.refresh();
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ClassCard({
  item,
  activeHold,
  studentId,
  onChanged,
}: {
  item: ClassStats;
  activeHold: MyHold | undefined;
  studentId: string | null;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = item.availableSeats <= 0;
  const headingId = `class-${item.id}`;

  const apply = async () => {
    if (!studentId || applying) return;
    setApplying(true);
    setError(null);
    try {
      const hold = await createHold(item.id, studentId);
      navigate(`/holds/${hold.holdId}`);
    } catch (err) {
      setError(friendlyError(err));
      if (err instanceof ApiError && (err.code === 'ALREADY_APPLIED' || err.code === 'SEATS_FULL')) onChanged();
      setApplying(false);
    }
  };

  return (
    <article className="card class-card" aria-labelledby={headingId}>
      <div className="class-card__head">
        <h2 id={headingId} className="class-card__name">
          {item.name}
        </h2>
        {full && <span className="badge badge--full">Full</span>}
      </div>

      <SeatBar total={item.totalSeats} held={item.heldSeats} confirmed={item.confirmedSeats} />

      <div className="class-card__numbers tabular">
        <p className="class-card__available">
          <strong>
            {number.format(item.availableSeats)} of {number.format(item.totalSeats)} available
          </strong>
        </p>
        <p className="class-card__breakdown">
          <span className="legend legend--confirmed">{number.format(item.confirmedSeats)} confirmed</span>
          <span className="legend legend--held">{number.format(item.heldSeats)} on hold</span>
        </p>
      </div>

      {error && (
        <div className="notice notice--error" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="class-card__actions">
        {activeHold ? (
          <>
            <span className={`badge badge--${activeHold.status === 'CONFIRMED' ? 'confirmed' : 'held'}`}>
              {activeHold.status === 'CONFIRMED' ? 'Admission confirmed' : 'Seat on hold'}
            </span>
            <Link className="btn btn-secondary" to={`/holds/${activeHold.holdId}`}>
              View your application
            </Link>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!studentId || full || applying}
            onClick={apply}
            aria-describedby={full ? `${headingId}-full` : undefined}
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        )}
        {full && !activeHold && (
          <p id={`${headingId}-full`} className="inline-hint">
            All seats are taken. A seat may open again if a hold expires.
          </p>
        )}
      </div>
    </article>
  );
}

/** Announce only meaningful changes (a class filling up or reopening), never every poll tick. */
function useAvailabilityAnnouncement(classes: ClassStats[] | undefined): string {
  const previous = useRef<Map<string, boolean> | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!classes) return;
    const current = new Map(classes.map((c) => [c.id, c.availableSeats <= 0]));
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    const changes: string[] = [];
    for (const c of classes) {
      const wasFull = before.get(c.id);
      const isFull = current.get(c.id);
      if (wasFull === false && isFull) changes.push(`${c.name} is now full.`);
      if (wasFull === true && !isFull) changes.push(`A seat opened in ${c.name}.`);
    }
    if (changes.length) setMessage(changes.join(' '));
  }, [classes]);

  return message;
}
