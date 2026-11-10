import type { HoldStatus } from '../api/types';

const LABELS: Record<HoldStatus, string> = {
  HELD: 'On hold',
  CONFIRMED: 'Confirmed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

/** Status as text plus colour plus a shape, so it never relies on colour alone. */
export function StatusBadge({ status }: { status: HoldStatus }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
