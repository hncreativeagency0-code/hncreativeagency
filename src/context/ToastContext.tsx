import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { errorMessage } from '@/lib/supabase';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }
interface ToastCtx { success: (t: string) => void; error: (e: unknown) => void; info: (t: string) => void }
const Ctx = createContext<ToastCtx>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const api: ToastCtx = {
    success: (t) => push('success', t),
    error: (e) => push('error', errorMessage(e)),
    info: (t) => push('info', t),
  };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  const color = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-brand' };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className="flex animate-fadein items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card dark:border-navy-700 dark:bg-navy-800">
              <I className={`mt-0.5 h-5 w-5 shrink-0 ${color[t.kind]}`} />
              <p className="flex-1 text-sm text-navy dark:text-slate-100">{t.text}</p>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-navy dark:hover:text-white" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
