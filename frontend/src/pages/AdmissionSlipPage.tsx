import { Link, useParams } from 'react-router-dom';
import { getHold } from '../api/endpoints';
import { friendlyError } from '../api/messages';
import { RequireStudentHint } from '../components/RequireStudentHint';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePolling } from '../hooks/usePolling';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { useStudent } from '../state/StudentContext';

const paidAt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka',
});

export function AdmissionSlipPage() {
  useLocale();
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  useDocumentTitle(t('slip.title'));
  const hold = usePolling((signal) => getHold(holdId, studentId, signal), 5000, [holdId, studentId]);

  if (!studentId) {
    return (
      <div className="empty">
        <h1>{t('slip.title')}</h1>
        <RequireStudentHint message="slip.needStudent" />
      </div>
    );
  }
  if (!hold.data) {
    return hold.loading ? (
      <p aria-busy="true">{t('slip.loading')}</p>
    ) : (
      <div className="notice notice--error" role="alert">
        <p>{friendlyError(hold.error)}</p>
      </div>
    );
  }

  const data = hold.data;
  if (data.status !== 'CONFIRMED' || !data.admissionNo) {
    return (
      <div className="empty">
        <h1>{t('slip.title')}</h1>
        <p>{t('slip.notYet')}</p>
        <Link className="btn btn-secondary" to={`/holds/${holdId}`}>
          {t('slip.back')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page__header no-print">
        <h1>{t('slip.title')}</h1>
        <div className="slip-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            {t('slip.print')}
          </button>
          <Link className="btn btn-secondary" to={`/holds/${holdId}`}>
            {t('slip.back')}
          </Link>
        </div>
      </div>

      <article className="slip" aria-label={t('slip.title')}>
        <header className="slip__head">
          <p className="slip__school">{t('slip.school')}</p>
          <p className="slip__title">{t('slip.heading')}</p>
        </header>
        <dl className="slip__grid">
          <div>
            <dt>{t('hold.admissionNumber')}</dt>
            <dd className="slip__number tabular">{data.admissionNo}</dd>
          </div>
          <div>
            <dt>{t('slip.student')}</dt>
            <dd className="tabular">{data.studentId}</dd>
          </div>
          <div>
            <dt>{t('slip.classShift')}</dt>
            <dd>{data.className}</dd>
          </div>
          <div>
            <dt>{t('slip.status')}</dt>
            <dd>{t('hold.status.CONFIRMED')}</dd>
          </div>
          <div>
            <dt>{t('slip.paid')}</dt>
            <dd className="tabular">
              {data.confirmedAt ? `${paidAt.format(new Date(data.confirmedAt))} (${t('slip.dhakaTime')})` : '—'}
            </dd>
          </div>
        </dl>
        <p className="slip__note">{t('slip.keep')}</p>
      </article>
    </>
  );
}
