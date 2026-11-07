import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';

/**
 * In-page replacements for window.confirm / window.prompt (which embedded browsers and
 * some app views block). Usage: `if (await askConfirm('Delete?')) …` / `const r = await askPrompt('Reason?')`.
 */
type Req =
  | { kind: 'confirm'; message: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; message: string; confirmLabel?: string; placeholder?: string; resolve: (v: string | null) => void };

let push: ((r: Req) => void) | null = null;

export function askConfirm(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => (push ? push({ kind: 'confirm', message, ...opts, resolve }) : resolve(false)));
}
export function askPrompt(message: string, opts: { confirmLabel?: string; placeholder?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => (push ? push({ kind: 'prompt', message, ...opts, resolve }) : resolve(null)));
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const [text, setText] = useState('');
  const ref = useRef<Req | null>(null);
  useEffect(() => { push = (r) => { ref.current?.kind === 'confirm' ? ref.current.resolve(false) : ref.current?.resolve(null as never); ref.current = r; setText(''); setReq(r); }; return () => { push = null; }; }, []);
  const close = (value: boolean | string | null) => {
    const r = ref.current; ref.current = null; setReq(null);
    if (!r) return;
    if (r.kind === 'confirm') r.resolve(value === true);
    else r.resolve(typeof value === 'string' && value.trim() ? value.trim() : null);
  };
  return (
    <>
      {children}
      <Modal open={!!req} onClose={() => close(req?.kind === 'confirm' ? false : null)} title={req?.kind === 'prompt' ? 'Details needed' : 'Please confirm'}>
        {req && (
          <form onSubmit={(e) => { e.preventDefault(); close(req.kind === 'confirm' ? true : text); }} className="space-y-4">
            <p className="text-sm text-navy/80 dark:text-slate-300">{req.message}</p>
            {req.kind === 'prompt' && <Textarea id="dialog-input" autoFocus rows={3} value={text} placeholder={req.placeholder} onChange={(e) => setText(e.target.value)} maxLength={1000} />}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(req.kind === 'confirm' ? false : null)}>Cancel</Button>
              <Button type="submit" variant={req.kind === 'confirm' && req.danger ? 'danger' : 'primary'} disabled={req.kind === 'prompt' && !text.trim()}>
                {req.confirmLabel ?? (req.kind === 'confirm' ? 'Confirm' : 'Submit')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
