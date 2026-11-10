/**
 * Stacked bar: confirmed | held | available. Purely visual (aria-hidden); the numbers are always shown as text.
 * Two full-width layers scaled with transform (no layout work when counts change): the held layer covers
 * confirmed + held, and the confirmed layer sits on top of it.
 */
export function SeatBar({ total, held, confirmed }: { total: number; held: number; confirmed: number }) {
  // A handful of seats in a 10,000-seat class would round to nothing: keep any non-zero share visible.
  const share = (value: number) => (total > 0 && value > 0 ? Math.min(1, Math.max(value / total, 0.012)) : 0);
  return (
    <div className="seatbar" aria-hidden="true">
      <span className="seatbar__layer seatbar__layer--held" style={{ transform: `scaleX(${share(confirmed + held)})` }} />
      <span className="seatbar__layer seatbar__layer--confirmed" style={{ transform: `scaleX(${share(confirmed)})` }} />
    </div>
  );
}
