import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createClass } from '../api/endpoints';
import { friendlyError } from '../api/messages';
import type { CreatedClass } from '../api/types';

const MAX_NAME = 200;
const MAX_SEATS = 100_000;
const NAME_ERROR = 'Enter a class name, e.g. Class 6 – Morning Shift.';
const NAME_TOO_LONG = `Keep the class name to ${MAX_NAME} characters or fewer.`;
const SEATS_ERROR = 'Seats must be a whole number from 1 to 100,000.';

interface Errors {
  name?: string;
  seats?: string;
}

function validate(name: string, seats: string): Errors {
  const errors: Errors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = NAME_ERROR;
  else if (trimmed.length > MAX_NAME) errors.name = NAME_TOO_LONG;
  const value = Number(seats.trim());
  if (!/^\d+$/.test(seats.trim()) || value < 1 || value > MAX_SEATS) errors.seats = SEATS_ERROR;
  return errors;
}

export function AdminPage() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClass | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const seatsRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate(name, seats);
    setErrors(found);
    setServerError(null);
    if (found.name) return nameRef.current?.focus();
    if (found.seats) return seatsRef.current?.focus();

    setSubmitting(true);
    setCreated(null);
    try {
      const result = await createClass(name.trim(), Number(seats.trim()));
      setCreated(result);
      setName('');
      setSeats('');
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1>School admin</h1>
          <p className="page__lede">
            Create a class for admission. Each shift is its own class with its own seats, for example
            &ldquo;Class 6 – Morning Shift&rdquo; and &ldquo;Class 6 – Day Shift&rdquo;.
          </p>
        </div>
      </div>

      <div className="admin-layout">
        <form className="card stack" onSubmit={onSubmit} noValidate aria-labelledby="create-class-title">
          <h2 id="create-class-title">Create a class</h2>

          <div className="field">
            <label className="field__label" htmlFor="class-name">
              Class name
            </label>
            <input
              ref={nameRef}
              id="class-name"
              className="input"
              value={name}
              maxLength={MAX_NAME + 50}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'class-name-error class-name-hint' : 'class-name-hint'}
            />
            <p id="class-name-hint" className="field__hint">
              Include the shift, e.g. Class 6 – Morning Shift.
            </p>
            {errors.name && (
              <p id="class-name-error" className="field__error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="class-seats">
              Number of seats
            </label>
            <input
              ref={seatsRef}
              id="class-seats"
              className="input input--short tabular"
              inputMode="numeric"
              autoComplete="off"
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              aria-invalid={errors.seats ? true : undefined}
              aria-describedby={errors.seats ? 'class-seats-error' : undefined}
            />
            {errors.seats && (
              <p id="class-seats-error" className="field__error">
                {errors.seats}
              </p>
            )}
          </div>

          {serverError && (
            <div className="notice notice--error" role="alert">
              <p>{serverError}</p>
            </div>
          )}

          <div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create class'}
            </button>
          </div>

          <div role="status" aria-live="polite">
            {created && (
              <div className="notice notice--success">
                <p className="notice__title">
                  Class created: {created.name} ({new Intl.NumberFormat('en-US').format(created.totalSeats)} seats)
                </p>
                <p>
                  Parents can apply now. <Link to="/">View in class list</Link>
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
