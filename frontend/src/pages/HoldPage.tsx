import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { cancelHold, confirmHold, createHold, getClass, getHold } from '../api/endpoints';
import { friendlyError } from '../api/messages';
import type { ClassStats, HoldStatus } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RequireStudentHint } from '../components/RequireStudentHint';
import { StatusBadge } from '../components/StatusBadge';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePolling } from '../hooks/usePolling';
import { useStudent } from '../state/StudentContext';

const URGENT_MS = 60_000;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function HoldPage() {
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  const navigate = useNavigate();

  const hold = usePolling((signal) => getHold(holdId, signal), 3000, [holdId]);
  const data = hold.data;

  // Set right after a successful pay/cancel so the screen updates before the next poll.
  const [override, setOverride] = useState<HoldStatus | null>(null);
  useEffect(() => setOverride(null), [holdId]);

  const baseStatus = override ?? data?.status;
  const countdown = useCountdown(baseStatus === 'HELD' ? data?.expiresAt : undefined);
  const status: HoldStatus | undefined = baseStatus === 'HELD' && countdown.isExpired ? 'EXPIRED' : baseStatus;
  const ended = status === 'EXPIRED' || status === 'CANCELLED';

  const seats = usePolling<ClassStats | undefined>(
    (signal) => (data && ended ? getClass(data.classId, signal) : Promise.resolve(undefined)),
    3000,
    [data?.classId, ended],
  );

  const [paying, setPaying] = useState(false);
  const payLock = useRef(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const announcement = useStatusAnnouncement(status);
  useDocumentTitle(
    status === 'HELD' ? `${countdown.mmss} left to pay` : data?.className ? `Application: ${data.className}` : 'Application',
  );

  if (hold.loading) return <HoldSkeleton />;

  if (!data) {
    const missing = hold.error instanceof ApiError && ['HOLD_NOT_FOUND', 'INVALID_ID'].includes(hold.error.code);
    return (
      <div className="empty" role={missing ? undefined : 'alert'}>
        <h1>{missing ? 'Application not found' : 'This application could not be loaded'}</h1>
        <p>{friendlyError(hold.error)}</p>
        <Link className="btn btn-secondary" to="/me">
          Go to My applications
        </Link>
      </div>
    );
  }

  const className = data.className ?? 'Your application';
  const someoneElse = Boolean(studentId && data.studentId && data.studentId !== studentId);
  const urgent = status === 'HELD' && countdown.remainingMs <= URGENT_MS;

  const pay = async () => {
    if (!studentId || payLock.current) return;
    payLock.current = true;
    setPaying(true);
    setActionError(null);
    try {
      await confirmHold(holdId, studentId);
      setOverride('CONFIRMED');
      void hold.refresh();
    } catch (err) {
      setActionError(friendlyError(err));
      void hold.refresh();
    } finally {
      payLock.current = false;
      setPaying(false);
    }
  };

  const cancel = async () => {
    if (!studentId || cancelling) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelHold(holdId, studentId);
      setOverride('CANCELLED');
      setCancelOpen(false);
      void hold.refresh();
    } catch (err) {
      setActionError(friendlyError(err));
      setCancelOpen(false);
      void hold.refresh();
    } finally {
      setCancelling(false);
    }
  };

  const applyAgain = async () => {
    if (!studentId || reapplying) return;
    setReapplying(true);
    setActionError(null);
    try {
      const fresh = await createHold(data.classId, studentId);
      navigate(`/holds/${fresh.holdId}`);
    } catch (err) {
      setActionError(friendlyError(err));
      void seats.refresh();
    } finally {
      setReapplying(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div className="hold-title">
          <p className="hold-title__kicker">Application</p>
          <h1 className="hold-title__name">{className}</h1>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <section className="card hold-card" aria-label="Application status">
        {status === 'HELD' && (
          <div className={`countdown${urgent ? ' countdown--urgent' : ''}`}>
            <p id="countdown-label" className="countdown__label">
              Time left to pay
            </p>
            <p role="timer" aria-labelledby="countdown-label" aria-live="off" className="countdown__value tabular">
              {countdown.mmss}
            </p>
            {urgent ? (
              <p className="countdown__note countdown__note--urgent">
                <strong>Less than a minute left.</strong> Pay now to keep this seat.
              </p>
            ) : (
              <p className="countdown__note">
                Your seat is held until {timeFormat.format(new Date(data.expiresAt))}. If the fee is not paid by then,
                the seat goes to the next applicant.
              </p>
            )}
          </div>
        )}

        {status === 'CONFIRMED' && (
          <div className="outcome outcome--success">
            <h2>Admission confirmed</h2>
            <p>The admission fee is paid. The seat in {className} is confirmed for this student.</p>
            <Link to="/me">See all applications</Link>
          </div>
        )}

        {status === 'EXPIRED' && (
          <div className="outcome outcome--danger">
            <h2>Time ran out</h2>
            <p>The fee was not paid in time, so the seat was released. This application can no longer be paid.</p>
          </div>
        )}

        {status === 'CANCELLED' && (
          <div className="outcome">
            <h2>Application cancelled</h2>
            <p>The seat was released for other applicants.</p>
          </div>
        )}

        {someoneElse && (
          <div className="notice notice--warning">
            <p>{friendlyError(new ApiError('FORBIDDEN', 403, ''))}</p>
          </div>
        )}

        {actionError && (
          <div className="notice notice--error" role="alert">
            <p>{actionError}</p>
          </div>
        )}

        {(status === 'HELD' || status === 'EXPIRED') && (
          <div className="hold-actions">
            <button
              type="button"
              className="btn btn-primary hold-actions__pay"
              disabled={!studentId || someoneElse || paying || status !== 'HELD'}
              onClick={pay}
            >
              {paying ? 'Paying…' : 'Pay admission fee'}
            </button>
            {status === 'HELD' && !cancelOpen && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!studentId || someoneElse || paying}
                onClick={() => setCancelOpen(true)}
              >
                Cancel application
              </button>
            )}
          </div>
        )}

        {status === 'HELD' && cancelOpen && (
          <ConfirmDialog
            title="Cancel this application?"
            body="The seat will be released right away and may go to another student. This can't be undone."
            confirmLabel="Yes, cancel"
            cancelLabel="Keep my seat"
            busy={cancelling}
            onConfirm={cancel}
            onCancel={() => setCancelOpen(false)}
          />
        )}

        {!studentId && status === 'HELD' && <RequireStudentHint action="pay or cancel" />}

        {ended && (
          <div className="hold-actions">
            {seats.data && seats.data.availableSeats > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!studentId || reapplying}
                onClick={applyAgain}
              >
                {reapplying ? 'Applying…' : 'Apply again'}
              </button>
            )}
            {seats.data && seats.data.availableSeats <= 0 && (
              <p className="inline-hint">Apply again isn&apos;t possible. This class is full right now.</p>
            )}
            {!studentId && <RequireStudentHint action="apply again" />}
          </div>
        )}
      </section>

      <p className="hold-footer">
        <Link to="/me">All my applications</Link> · <Link to="/">Class list</Link>
      </p>
    </>
  );
}

function HoldSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading application">
      <span className="skeleton skeleton--text" style={{ width: '45%', height: '1.8em' }} />
      <div className="card hold-card" style={{ marginTop: 20 }}>
        <span className="skeleton" style={{ width: 180, height: 64 }} />
        <span className="skeleton skeleton--text" style={{ width: '70%', marginTop: 16 }} />
        <span className="skeleton" style={{ height: 44, marginTop: 20 }} />
      </div>
    </div>
  );
}

const ANNOUNCEMENTS: Partial<Record<HoldStatus, string>> = {
  CONFIRMED: 'Admission confirmed.',
  EXPIRED: 'Time ran out. The seat was released.',
  CANCELLED: 'Application cancelled.',
};

function useStatusAnnouncement(status: HoldStatus | undefined): string {
  const previous = useRef<HoldStatus | undefined>(undefined);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (previous.current && status && previous.current !== status) setMessage(ANNOUNCEMENTS[status] ?? '');
    previous.current = status;
  }, [status]);
  return message;
}
