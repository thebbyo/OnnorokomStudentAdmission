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
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

const URGENT_MS = 60_000;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function HoldPage() {
  useLocale();
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  const navigate = useNavigate();

  const hold = usePolling((signal) => getHold(holdId, studentId, signal), 3000, [holdId, studentId]);
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
        <h1>{missing ? t('hold.notFound.title') : t('hold.loadError.title')}</h1>
        <p>{friendlyError(hold.error)}</p>
        <Link className="btn btn-secondary" to="/me">
          {t('hold.goToMine')}
        </Link>
      </div>
    );
  }

  const className = data.className ?? t('hold.fallbackName');
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
          <p className="hold-title__kicker">{t('hold.kicker')}</p>
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
              {t('hold.timeLeft')}
            </p>
            <p role="timer" aria-labelledby="countdown-label" aria-live="off" className="countdown__value tabular">
              {countdown.mmss}
            </p>
            {urgent ? (
              <p className="countdown__note countdown__note--urgent">
                <strong>{t('hold.urgent')}</strong> {t('hold.urgentBody')}
              </p>
            ) : (
              <p className="countdown__note">
                {t('hold.heldUntil', { time: timeFormat.format(new Date(data.expiresAt)) })}
              </p>
            )}
          </div>
        )}

        {status === 'CONFIRMED' && (
          <div className="outcome outcome--success">
            <h2>{t('hold.confirmed.title')}</h2>
            <p>{t('hold.confirmed.body', { className })}</p>
            {data.admissionNo && (
              <p>
                {t('hold.admissionNumber')}: <strong className="tabular">{data.admissionNo}</strong>
              </p>
            )}
            <p>
              <Link to={`/holds/${holdId}/slip`}>{t('hold.viewSlip')}</Link> · <Link to="/me">{t('hold.allApplications')}</Link>
            </p>
          </div>
        )}

        {status === 'EXPIRED' && (
          <div className="outcome outcome--danger">
            <h2>{t('hold.expired.title')}</h2>
            <p>{t('hold.expired.body')}</p>
          </div>
        )}

        {status === 'CANCELLED' && (
          <div className="outcome">
            <h2>{t('hold.cancelled.title')}</h2>
            <p>{t('hold.cancelled.body')}</p>
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
              {paying ? t('hold.paying') : t('hold.pay')}
            </button>
            {status === 'HELD' && !cancelOpen && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!studentId || someoneElse || paying}
                onClick={() => setCancelOpen(true)}
              >
                {t('hold.cancel')}
              </button>
            )}
          </div>
        )}

        {status === 'HELD' && cancelOpen && (
          <ConfirmDialog
            title={t('hold.cancelDialog.title')}
            body={t('hold.cancelDialog.body')}
            confirmLabel={t('hold.cancelDialog.confirm')}
            cancelLabel={t('hold.cancelDialog.keep')}
            busy={cancelling}
            onConfirm={cancel}
            onCancel={() => setCancelOpen(false)}
          />
        )}

        {!studentId && status === 'HELD' && <RequireStudentHint message="hint.payNeedsStudent" />}

        {ended && (
          <div className="hold-actions">
            {seats.data && seats.data.availableSeats > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!studentId || reapplying}
                onClick={applyAgain}
              >
                {reapplying ? t('classes.applying') : t('hold.applyAgain')}
              </button>
            )}
            {seats.data && seats.data.availableSeats <= 0 && (
              <p className="inline-hint">{t('hold.applyAgainFull')}</p>
            )}
            {!seats.data && seats.error !== undefined && (
              <p className="inline-hint" role="alert">
                {friendlyError(seats.error)}
              </p>
            )}
            {!studentId && <RequireStudentHint message="hint.applyNeedsStudent" />}
          </div>
        )}
      </section>

      <p className="hold-footer">
        <Link to="/me">{t('hold.footer.mine')}</Link> · <Link to="/">{t('hold.footer.classes')}</Link>
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

function announce(status: HoldStatus | undefined): string {
  if (status === 'CONFIRMED') return t('hold.confirmed.title') + '.';
  if (status === 'EXPIRED') return t('hold.expired.title') + '. ' + t('hold.expired.body');
  if (status === 'CANCELLED') return t('hold.cancelled.title') + '.';
  return '';
}

function useStatusAnnouncement(status: HoldStatus | undefined): string {
  const previous = useRef<HoldStatus | undefined>(undefined);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (previous.current && status && previous.current !== status) setMessage(announce(status));
    previous.current = status;
  }, [status]);
  return message;
}
