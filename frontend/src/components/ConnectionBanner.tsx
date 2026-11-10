import { useConnection } from '../hooks/useConnection';

export function ConnectionBanner() {
  const online = useConnection();
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="connection-banner">
          <p>Can&apos;t reach the admission server. Retrying…</p>
        </div>
      )}
    </div>
  );
}
