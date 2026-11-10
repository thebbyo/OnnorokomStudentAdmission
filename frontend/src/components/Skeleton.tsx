export function SkeletonCard() {
  return (
    <div className="card class-card" aria-hidden="true">
      <span className="skeleton skeleton--text" style={{ width: '55%', height: '1.3em' }} />
      <span className="skeleton" style={{ height: 12, marginTop: 16 }} />
      <span className="skeleton skeleton--text" style={{ width: '40%', marginTop: 12 }} />
      <span className="skeleton" style={{ width: 120, height: 44, marginTop: 16 }} />
    </div>
  );
}
