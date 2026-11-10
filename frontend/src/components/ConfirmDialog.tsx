import { useEffect, useId, useRef } from 'react';
import { t } from '../i18n';

/**
 * Inline confirmation step (no modal): focus lands on the safe choice, Escape keeps things as they are.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const safeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    safeRef.current?.focus();
  }, []);

  return (
    <div
      className="confirm"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <p id={titleId} className="confirm__title">
        {title}
      </p>
      <p id={bodyId}>{body}</p>
      <div className="confirm__actions">
        <button ref={safeRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? t('hold.cancelDialog.busy') : confirmLabel}
        </button>
      </div>
    </div>
  );
}
