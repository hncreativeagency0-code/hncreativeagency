import { useState } from 'react';
import { X } from 'lucide-react';

export function TagInput({ label, value, onChange, max = 10, placeholder = 'Type and press Enter', hint }: {
  label?: string; value: string[]; onChange: (v: string[]) => void; max?: number; placeholder?: string; hint?: string;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const parts = text.split(',').map((t) => t.trim().slice(0, 40)).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next); setText('');
  };
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-navy dark:text-slate-200">{label}</label>}
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 dark:border-navy-700 dark:bg-navy-900">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand/15 dark:text-brand-200">
            {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {value.length < max && (
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={value.length ? '' : placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)); }}
            onBlur={add} className="h-7 min-w-[120px] flex-1 bg-transparent text-sm outline-none" />
        )}
      </div>
      <p className="text-xs text-muted">{hint ?? `${value.length}/${max}`}</p>
    </div>
  );
}
