/** Stacked bar: confirmed | held | available. Purely visual; the numbers are always shown as text next to it. */
export function SeatBar({ total, held, confirmed }: { total: number; held: number; confirmed: number }) {
  const pct = (value: number) => `${total > 0 ? Math.min(100, (value / total) * 100) : 0}%`;
  return (
    <div className="seatbar" aria-hidden="true">
      <span className="seatbar__segment seatbar__segment--confirmed" style={{ width: pct(confirmed) }} />
      <span className="seatbar__segment seatbar__segment--held" style={{ width: pct(held) }} />
    </div>
  );
}
