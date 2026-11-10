import { useParams, Link } from 'react-router-dom';
import { friendlyError } from '../api/messages';
import { getHold } from '../api/endpoints';
import { usePolling } from '../hooks/usePolling';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStudent } from '../state/StudentContext';
import { RequireStudentHint } from '../components/RequireStudentHint';

const paidAt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka',
});

export function AdmissionSlipPage() {
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  useDocumentTitle('Admission slip');
  const hold = usePolling((signal) => getHold(holdId, studentId, signal), 5000, [holdId, studentId]);

  if (!studentId) {
    return (
      <div className="empty">
        <h1>Admission slip</h1>
        <RequireStudentHint action="see the slip" />
      </div>
    );
  }
  if (!hold.data) {
    return hold.loading ? (
      <p aria-busy="true">Loading the slip…</p>
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
        <h1>Admission slip</h1>
        <p>A slip is issued once the admission fee is paid. Your seat is not confirmed yet.</p>
        <Link className="btn btn-secondary" to={`/holds/${holdId}`}>
          Back to application
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page__header no-print">
        <h1>Admission slip</h1>
        <div className="slip-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print slip
          </button>
          <Link className="btn btn-secondary" to={`/holds/${holdId}`}>
            Back to application
          </Link>
        </div>
      </div>

      <article className="slip" aria-label="Admission slip">
        <header className="slip__head">
          <p className="slip__school">School Admission Portal</p>
          <p className="slip__title">Admission confirmation</p>
        </header>
        <dl className="slip__grid">
          <div>
            <dt>Admission number</dt>
            <dd className="slip__number tabular">{data.admissionNo}</dd>
          </div>
          <div>
            <dt>Student (birth registration no.)</dt>
            <dd className="tabular">{data.studentId}</dd>
          </div>
          <div>
            <dt>Class and shift</dt>
            <dd>{data.className}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Confirmed</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd className="tabular">{data.confirmedAt ? `${paidAt.format(new Date(data.confirmedAt))} (Dhaka time)` : '—'}</dd>
          </div>
        </dl>
        <p className="slip__note">Keep this slip. Show it when you visit the school office for enrolment.</p>
      </article>
    </>
  );
}
