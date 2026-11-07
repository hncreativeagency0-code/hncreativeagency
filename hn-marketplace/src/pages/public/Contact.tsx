import { useState } from 'react';
import { Mail, Phone, MapPin, MessageCircle, Clock, CalendarDays, CircleDot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteContact, waLink } from '@/lib/site';
import { useSeo } from '@/lib/seo';
import { track } from '@/lib/analytics';
import { usePublicSettings } from '@/lib/hooks';
import { readyChannels } from '@/pages/app/Checkout';
import { supabase, errorMessage } from '@/lib/supabase';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';

const SERVICES = ['Graphic Design', 'Branding & Identity', 'Video Editing', 'Website Design & Development', 'Social Media Management', 'Digital Marketing', 'Full Package', 'Marketplace support'];

export function ContactForm() {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', service: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Enter your name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) er.email = 'Enter a valid email';
    if (f.message.trim().length < 10) er.message = 'Tell us a little more (at least 10 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const { error } = await supabase.from('contact_messages').insert({ name: f.name.trim(), email: f.email.trim(), service: f.service || null, message: f.message.trim() });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    track('contact', { method: 'form', service: f.service });
    setSent(true);
  };

  if (sent) return (
    <div className="py-10 text-center">
      <p className="font-heading text-xl font-semibold">Thank you, {f.name.split(' ')[0]}!</p>
      <p className="mt-2 text-muted">We received your message and will reply to {f.email} within one business day.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Your name" name="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required />
        <Input label="Email address" name="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} required />
      </div>
      <Select label="Service required" name="service" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
        <option value="">Select a service</option>
        {SERVICES.map((s) => <option key={s}>{s}</option>)}
      </Select>
      <Textarea label="Your message" name="message" rows={5} value={f.message} maxLength={4000} onChange={(e) => setF({ ...f, message: e.target.value })} error={errors.message} required />
      <Button type="submit" size="lg" className="w-full" loading={busy}>Get Started →</Button>
    </form>
  );
}

export default function Contact() {
  const c = useSiteContact();
  const s = usePublicSettings();
  useSeo({ title: 'Contact Us – WhatsApp, Email & Office in Lahore', description: 'Talk to HN Creative Agency in Urdu or English on WhatsApp, by email or at our Lahore office.', path: '/contact' });
  const channels = readyChannels(s);
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-4xl font-semibold text-navy dark:text-white">Contact us</h1>
        <p className="mt-3 text-muted">Questions about an order, the marketplace, or an agency project? WhatsApp is fastest — we reply in Urdu or English.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={waLink(c.whatsapp, 'Assalam o Alaikum! I have a question.')} target="_blank" rel="noopener noreferrer" onClick={() => track('contact', { method: 'whatsapp' })}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-6 font-semibold text-white shadow-sm hover:brightness-95"><MessageCircle className="h-5 w-5" />Chat on WhatsApp</a>
          <Link to="/book-consultation" className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-300 px-6 font-medium hover:border-brand hover:text-brand dark:border-navy-700"><CalendarDays className="h-5 w-5" />Book a free consultation</Link>
        </div>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          {[
            { i: Mail, l: 'Email', v: c.email, h: `mailto:${c.email}` },
            { i: MessageCircle, l: 'WhatsApp', v: c.phone, h: c.whatsappUrl },
            { i: Phone, l: 'Phone', v: c.phone, h: c.telUrl },
            { i: MapPin, l: 'Office', v: c.address },
            { i: Clock, l: 'Support hours', v: c.hours },
          ].map((x) => (
            <Card key={x.l} className="flex items-center gap-4 p-4">
              <span className="rounded-xl bg-brand-50 p-3 dark:bg-brand/15"><x.i className="h-5 w-5 text-brand" /></span>
              <div className="min-w-0"><p className="text-xs text-muted">{x.l}</p>{x.h ? <a href={x.h} className="break-all font-medium hover:text-brand">{x.v}</a> : <p className="font-medium">{x.v}</p>}</div>
            </Card>
          ))}
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Service status</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-emerald-500" />Marketplace & messaging — operational</li>
              <li className="flex items-center gap-2"><CircleDot className={`h-4 w-4 ${channels.length ? 'text-emerald-500' : 'text-amber-500'}`} />Payments — {channels.length ? `${channels.length} method${channels.length > 1 ? 's' : ''} available` : 'contact us to pay'}</li>
              <li className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-emerald-500" />Payment verification — within business hours</li>
            </ul>
          </Card>
          <p className="px-1 text-sm text-muted">For an issue with a specific order, open it from <b>Dashboard → Orders</b> so our team sees the full history.</p>
        </div>
        <Card className="p-6 sm:p-8"><ContactForm /></Card>
      </div>
    </div>
  );
}
