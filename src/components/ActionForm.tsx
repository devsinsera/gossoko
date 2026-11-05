import { useState, type FormEvent, type FormHTMLAttributes } from 'react';
import { COLORS } from '@/lib/theme';

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  /** Runs with the form's fields. A thrown error is shown under the form. */
  action: (data: FormData) => Promise<unknown>;
  onDone?: (result: unknown) => void;
};

/** A form that runs an async function instead of navigating — the browser stand-in for a server action. */
export function ActionForm({ action, onDone, children, ...rest }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await action(data);
      onDone?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form {...rest} onSubmit={onSubmit}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'contents' }}>
        {children}
      </fieldset>
      {error && <p role="alert" style={{ color: COLORS.red, fontSize: 12, margin: '6px 0 0' }}>{error}</p>}
    </form>
  );
}
