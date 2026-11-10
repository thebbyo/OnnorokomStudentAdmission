/** Inline hint shown instead of a surprise error when an action needs the student's id. */
export function RequireStudentHint({ action }: { action: string }) {
  return (
    <p className="inline-hint" role="note">
      Enter the student's birth registration number above to {action}.
    </p>
  );
}
