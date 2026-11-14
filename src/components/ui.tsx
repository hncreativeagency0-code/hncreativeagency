import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star, X, AlertTriangle, BadgeCheck } from 'lucide-react';
import { cn, initials, type Tone } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600 shadow-sm hover:shadow-lift',
  secondary: 'bg-navy text-white hover:bg-navy-800 dark:bg-white dark:text-navy dark:hover:bg-slate-200',
  outline: 'border border-slate-300 bg-white text-navy hover:border-brand hover:text-brand dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100',
  ghost: 'text-navy hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-navy-800',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-60',
      size === 'sm' ? 'h-8 px-3 text-sm' : size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
      variants[variant], className)}
    {...rest}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
));

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cn('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150',
      size === 'sm' ? 'h-8 px-3 text-sm' : size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm', variants[variant], className)}>
      {children}
    </Link>
  );
}

const fieldBase = 'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy placeholder:text-slate-400 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-100';

interface FieldWrap { label?: string; error?: string; hint?: string; required?: boolean }
function Wrap({ label, error, hint, required, children, id }: FieldWrap & { children: ReactNode; id?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-sm font-medium text-navy dark:text-slate-200">{label}{required && <span className="text-red-500"> *</span>}</label>}
      {children}
      {error ? <p className="text-xs text-red-500">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrap>(({ label, error, hint, className, id, ...rest }, ref) => {
  const auto = useId();
  const fid = id || rest.name || auto;
  return <Wrap label={label} error={error} hint={hint} required={rest.required} id={fid}>
    <input ref={ref} id={fid} className={cn(fieldBase, 'h-10', error && 'border-red-400', className)} aria-invalid={!!error} {...rest} />
  </Wrap>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrap>(({ label, error, hint, className, id, ...rest }, ref) => {
  const auto = useId();
  const fid = id || rest.name || auto;
  return <Wrap label={label} error={error} hint={hint} required={rest.required} id={fid}>
    <textarea ref={ref} id={fid} className={cn(fieldBase, 'min-h-[100px] py-2', error && 'border-red-400', className)} aria-invalid={!!error} {...rest} />
  </Wrap>;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrap>(({ label, error, hint, className, id, children, ...rest }, ref) => {
  const auto = useId();
  const fid = id || rest.name || auto;
  return <Wrap label={label} error={error} hint={hint} required={rest.required} id={fid}>
    <select ref={ref} id={fid} className={cn(fieldBase, 'h-10', className)} {...rest}>{children}</select>
  </Wrap>;
});

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-navy-700 dark:bg-navy-800', className)} {...rest}>{children}</div>;
}

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-300',
};
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-brand', className)} />;

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200 dark:bg-navy-700', className)} />;
}

export function EmptyState({ icon: Icon, title, text, action }: { icon?: React.ComponentType<{ className?: string }>; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-navy-700">
      {Icon && <div className="mb-3 rounded-2xl bg-brand-50 p-3 dark:bg-brand/10"><Icon className="h-6 w-6 text-brand" /></div>}
      <h3 className="font-heading text-base font-semibold text-navy dark:text-white">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1"><p>{message}</p>{onRetry && <p className="mt-0.5 text-xs opacity-80">If this keeps happening, contact support and we’ll sort it out.</p>}</div>
      {onRetry && <button onClick={onRetry} className="font-medium underline">Try again</button>}
    </div>
  );
}

export function Avatar({ url, name, size = 40, online }: { url?: string | null; name?: string | null; size?: number; online?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {url && !broken ? (
        <img src={url} alt={name ?? ''} onError={() => setBroken(true)} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-700 font-heading font-semibold text-white" style={{ fontSize: size * 0.38 }}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={cn('absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-navy-800', online ? 'bg-emerald-500' : 'bg-slate-400')} style={{ width: size * 0.28, height: size * 0.28 }} />
      )}
    </span>
  );
}

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  if (!count) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
      <span className="font-semibold text-navy dark:text-white">{Number(value).toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <Star className={cn('h-7 w-7 transition', n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-navy-700')} />
        </button>
      ))}
    </div>
  );
}

export function VerifiedBadge() {
  return <BadgeCheck className="inline h-4 w-4 text-brand" aria-label="Verified" />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={cn('max-h-[92vh] w-full animate-fadein overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-navy-800 sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-navy dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100 dark:hover:bg-navy-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn('whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition',
            value === t.value ? 'bg-brand text-white' : 'text-muted hover:bg-slate-100 dark:hover:bg-navy-800')}>
          {t.label}{t.count ? <span className="ml-1.5 opacity-80">({t.count})</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-navy dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint }: { label: string; value: ReactNode; icon?: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-brand" />}
      </div>
      <div className="mt-2 font-heading text-2xl font-semibold text-navy dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Pagination({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (p: number) => void }) {
  if (page === 0 && !hasMore) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-sm text-muted">Page {page + 1}</span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

const PLACEHOLDER = (label: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6C63FF"/><stop offset="1" stop-color="#0F172A"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="620" cy="160" r="110" fill="none" stroke="#ffffff40" stroke-width="16"/><text x="60" y="520" font-family="Poppins,Arial,sans-serif" font-size="42" font-weight="700" fill="#fff">${label}</text></svg>`)}`;

/** Any user-uploaded image with a branded placeholder if the file is missing or broken. */
export function SafeImg({ src, alt, className, label }: { src: string | null | undefined; alt: string; className?: string; label?: string }) {
  const [broken, setBroken] = useState(false);
  const url = !src || broken ? PLACEHOLDER(label || 'HN Creative') : src;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

/** Image from the original site. Tries, in order: optimised .webp in /public, the original file in /public,
    the old live site, then a branded placeholder — so a missing file never shows a broken image. */
export function LegacyImg({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback?: ReactNode }) {
  const chain = [...(/\.(jpe?g|png)$/i.test(src) ? [src.replace(/\.(jpe?g|png)$/i, '.webp')] : []), src, `https://hncreativeagency.pages.dev${src}`];
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed && fallback) return <>{fallback}</>;
  const url = i < chain.length ? chain[i] : PLACEHOLDER(alt || 'HN Creative Agency');
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async"
    onError={() => {
      if (i < chain.length - 1) setI(i + 1);
      else if (fallback) setFailed(true);
      else if (i < chain.length) setI(chain.length);
    }} />;
}

/** "HN" monogram used when the logo image can't load. */
export function Monogram({ className }: { className?: string }) {
  return <span className={cn('flex items-center justify-center rounded-lg bg-brand font-heading text-sm font-bold text-white', className)}>HN</span>;
}
