import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Search, Send, Paperclip, Mic, Square, Phone, Video, MoreVertical, Reply, X, Download, FileText, Play, Pause, ArrowLeft,
  Ban, Check, CheckCheck, Briefcase, PhoneMissed, PhoneIncoming, Trash2, MessageSquare, FilePlus2,
} from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { uploadFile, signedUrl, openPrivateFile } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useCall } from '@/context/CallContext';
import type { ConversationRow, Message } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, Spinner, Textarea } from '@/components/ui';
import { ReportButton } from '@/components/cards';
import { cn, duration, fileSize, money, time, timeAgo, date } from '@/lib/utils';

const PAGE = 40;

/* ---------- Private media (signed URLs) ---------- */
function useSigned(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (path) signedUrl('chat-files', path).then(setUrl).catch(() => setUrl(null)); }, [path]);
  return url;
}

function VoicePlayer({ path, seconds, mine }: { path: string; seconds: number | null; mine: boolean }) {
  const url = useSigned(path);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = seconds ?? 0;
  return (
    <div className="flex w-56 items-center gap-3">
      <button onClick={() => (playing ? ref.current?.pause() : ref.current?.play())} disabled={!url}
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', mine ? 'bg-white/20' : 'bg-brand text-white')} aria-label={playing ? 'Pause' : 'Play voice message'}>
        {!url ? <Spinner className="h-4 w-4 text-current" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className={cn('h-1.5 overflow-hidden rounded-full', mine ? 'bg-white/30' : 'bg-slate-200 dark:bg-navy-700')}>
          <div className={cn('h-full rounded-full', mine ? 'bg-white' : 'bg-brand')} style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }} />
        </div>
        <p className="mt-1 text-[11px] opacity-80">{duration(playing || pos ? pos : total)}</p>
      </div>
      {url && <audio ref={ref} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} />}
    </div>
  );
}

function ImageMsg({ path }: { path: string }) {
  const url = useSigned(path);
  return url ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="max-h-64 max-w-[240px] rounded-xl object-cover" /></a>
    : <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-black/5"><Spinner /></div>;
}

/* ---------- Offer / request cards ---------- */
interface Offer { id: string; title: string; description: string; price: number; delivery_days: number; revisions: number; status: string; expires_at: string; order_id: string | null; client_id: string; freelancer_id: string }
interface Request { id: string; title: string; description: string; budget: number | null; deadline: string | null; attachments: { path: string; name: string }[]; status: string; client_id: string; freelancer_id: string }

function OfferCard({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [o, setO] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => supabase.from('custom_offers').select('*').eq('id', id).maybeSingle().then(({ data }) => setO(data as Offer)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!o) return <Spinner />;
  const act = async (action: 'accept' | 'decline' | 'withdraw') => {
    setBusy(true);
    try {
      const orderId = await rpc<string | null>('respond_custom_offer', { p_offer: o.id, p_action: action });
      if (action === 'accept' && orderId) { toast.success('Offer accepted — complete payment to start'); nav(`/app/checkout/${orderId}`); }
      else { toast.success(action === 'decline' ? 'Offer declined' : 'Offer withdrawn'); load(); onChanged(); }
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const expired = new Date(o.expires_at) < new Date() && o.status === 'pending';
  return (
    <div className="w-72 rounded-2xl border border-brand/30 bg-white p-4 text-navy dark:bg-navy-900 dark:text-slate-100">
      <div className="flex items-center justify-between"><Badge tone="brand">Custom offer</Badge><Badge tone={o.status === 'accepted' ? 'green' : o.status === 'pending' && !expired ? 'amber' : 'slate'}>{expired ? 'expired' : o.status}</Badge></div>
      <p className="mt-2 font-semibold">{o.title}</p>
      <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted">{o.description}</p>
      <div className="mt-3 flex justify-between text-sm"><span className="font-heading text-lg font-semibold">{money(o.price)}</span><span className="text-muted">{o.delivery_days}d · {o.revisions} rev.</span></div>
      {o.status === 'pending' && !expired && user?.id === o.client_id && (
        <div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" loading={busy} onClick={() => act('accept')}>Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => act('decline')}>Decline</Button></div>
      )}
      {o.status === 'pending' && !expired && user?.id === o.freelancer_id && <Button size="sm" variant="ghost" className="mt-2 w-full" loading={busy} onClick={() => act('withdraw')}>Withdraw offer</Button>}
      {o.order_id && <Link to={`/app/orders/${o.order_id}`} className="mt-3 block text-center text-sm font-medium text-brand">View order →</Link>}
    </div>
  );
}

function RequestCard({ id, onMakeOffer }: { id: string; onMakeOffer: (r: Request) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [r, setR] = useState<Request | null>(null);
  useEffect(() => { supabase.from('custom_requests').select('*').eq('id', id).maybeSingle().then(({ data }) => setR(data as Request)); }, [id]);
  if (!r) return <Spinner />;
  return (
    <div className="w-72 rounded-2xl border border-slate-200 bg-white p-4 text-navy dark:border-navy-700 dark:bg-navy-900 dark:text-slate-100">
      <Badge tone="sky">Project request</Badge>
      <p className="mt-2 font-semibold">{r.title}</p>
      <p className="mt-1 line-clamp-6 whitespace-pre-line text-sm text-muted">{r.description}</p>
      <div className="mt-2 space-y-0.5 text-sm">
        {r.budget && <p>Budget: <b>{money(r.budget)}</b></p>}
        {r.deadline && <p>Deadline: <b>{date(r.deadline)}</b></p>}
      </div>
      {r.attachments.map((a) => (
        <button key={a.path} onClick={() => openPrivateFile('chat-files', a.path).catch(toast.error)} className="mt-1 flex items-center gap-1 text-xs text-brand"><Paperclip className="h-3 w-3" />{a.name}</button>
      ))}
      {user?.id === r.freelancer_id && r.status === 'open' && <Button size="sm" className="mt-3 w-full" onClick={() => onMakeOffer(r)}>Send an offer</Button>}
      {r.status === 'offered' && <p className="mt-3 text-center text-xs text-muted">Offer sent</p>}
    </div>
  );
}

/* ---------- Voice recorder ---------- */
function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

function useRecorder(onDone: (blob: Blob, seconds: number, mime: string) => void) {
  const toast = useToast();
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = useRef(0);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = (Date.now() - start.current) / 1000;
      setSecs(s);
      if (s >= 300) rec.current?.stop(); // 5 minute cap
    }, 250);
    return () => clearInterval(t);
  }, [recording]);
  const begin = async () => {
    if (typeof MediaRecorder === 'undefined') return toast.error('Voice messages are not supported in this browser');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; cancelled.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const seconds = (Date.now() - start.current) / 1000;
        if (!cancelled.current && seconds >= 1) onDone(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }), seconds, r.mimeType || 'audio/webm');
      };
      rec.current = r; start.current = Date.now(); setSecs(0);
      r.start(250); setRecording(true);
    } catch (e) {
      toast.error((e as DOMException)?.name === 'NotAllowedError' ? 'Microphone permission was denied' : 'Could not start recording');
    }
  };
  return { recording, secs, begin, stop: () => rec.current?.stop(), cancel: () => { cancelled.current = true; rec.current?.stop(); } };
}

/* ---------- Thread ---------- */
function Thread({ conv, onBack, refreshList }: { conv: ConversationRow; onBack: () => void; refreshList: () => void }) {
  const { user, onlineUsers, profile } = useAuth();
  const toast = useToast();
  const { startCall } = useCall();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [otherRead, setOtherRead] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [blocked, setBlocked] = useState(conv.i_blocked);
  const [offerFor, setOfferFor] = useState<Partial<Request> | null>(null);
  const [search, setSearch] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<number>();
  const online = onlineUsers.has(conv.other_id);

  const markRead = useCallback(() => { rpc('mark_conversation_read', { p_conv: conv.conversation_id }).then(refreshList).catch(() => {}); }, [conv.conversation_id, refreshList]);

  useEffect(() => {
    setLoading(true); setMsgs([]); stick.current = true; setBlocked(conv.i_blocked);
    supabase.from('messages').select('*').eq('conversation_id', conv.conversation_id).order('created_at', { ascending: false }).limit(PAGE)
      .then(({ data }) => { setMsgs(((data as Message[]) ?? []).reverse()); setHasMore((data?.length ?? 0) === PAGE); setLoading(false); markRead(); });
    supabase.from('conversation_participants').select('last_read_at').eq('conversation_id', conv.conversation_id).eq('user_id', conv.other_id).maybeSingle()
      .then(({ data }) => setOtherRead(data?.last_read_at ?? null));

    const ch = supabase.channel(`conv:${conv.conversation_id}`, { config: { private: true, broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.conversation_id}` }, ({ new: m }) => {
        setMsgs((list) => (list.some((x) => x.id === (m as Message).id) ? list : [...list, m as Message]));
        if ((m as Message).sender_id !== user?.id) { setTyping(false); markRead(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.conversation_id}` }, ({ new: m }) => {
        setMsgs((list) => list.map((x) => (x.id === (m as Message).id ? (m as Message) : x)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conv.conversation_id}` }, ({ new: p }) => {
        const row = p as { user_id: string; last_read_at: string };
        if (row.user_id === conv.other_id) setOtherRead(row.last_read_at);
      })
      .on('broadcast', { event: 'typing' }, () => {
        setTyping(true); clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 3500);
      })
      .subscribe();
    chan.current = ch;
    return () => { supabase.removeChannel(ch); chan.current = null; };
  }, [conv.conversation_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const loadOlder = async () => {
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conv.conversation_id).lt('created_at', msgs[0].created_at).order('created_at', { ascending: false }).limit(PAGE);
    stick.current = false;
    setMsgs((m) => [...((data as Message[]) ?? []).reverse(), ...m]);
    setHasMore((data?.length ?? 0) === PAGE);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
  };

  const insert = async (row: Partial<Message>) => {
    stick.current = true;
    const { data, error } = await supabase.from('messages').insert({ conversation_id: conv.conversation_id, sender_id: user!.id, reply_to_id: replyTo?.id ?? null, ...row }).select().single();
    if (error) throw error;
    setMsgs((list) => (list.some((x) => x.id === data.id) ? list : [...list, data as Message]));
    setReplyTo(null);
    refreshList();
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { await insert({ kind: 'text', body }); setText(''); } catch (e) { toast.error(e); } finally { setSending(false); }
  };

  const sendFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setSending(true);
    try {
      for (const f of Array.from(files).slice(0, 5)) {
        const ref = await uploadFile('chat-files', `${conv.conversation_id}/${user!.id}`, f);
        await insert({ kind: f.type.startsWith('image/') ? 'image' : 'file', attachment_path: ref.path, attachment_name: f.name, attachment_mime: f.type, attachment_size: f.size });
      }
    } catch (e) { toast.error(e); } finally { setSending(false); }
  };

  const recorder = useRecorder(async (blob, seconds, mime) => {
    setSending(true);
    try {
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      const ref = await uploadFile('chat-files', `${conv.conversation_id}/${user!.id}`, blob, `voice.${ext}`);
      await insert({ kind: 'voice', attachment_path: ref.path, attachment_name: `Voice message.${ext}`, attachment_mime: mime, attachment_size: blob.size, duration_seconds: Math.round(seconds * 10) / 10 });
    } catch (e) { toast.error(e); } finally { setSending(false); }
  });

  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); chan.current?.send({ type: 'broadcast', event: 'typing', payload: {} }); }
  };

  const toggleBlock = async () => {
    setMenu(false);
    const { error } = blocked
      ? await supabase.from('user_blocks').delete().eq('blocker_id', user!.id).eq('blocked_id', conv.other_id)
      : await supabase.from('user_blocks').insert({ blocker_id: user!.id, blocked_id: conv.other_id });
    if (error) return toast.error(error);
    setBlocked(!blocked); toast.success(blocked ? 'User unblocked' : 'User blocked. They can no longer message or call you.'); refreshList();
  };

  const byId = new Map(msgs.map((m) => [m.id, m]));
  const shown = search ? msgs.filter((m) => m.body?.toLowerCase().includes(search.toLowerCase())) : msgs;
  const lastSeen = online ? 'Online' : conv.other_last_seen ? `Last seen ${timeAgo(conv.other_last_seen)}` : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5 dark:border-navy-700">
        <button onClick={onBack} className="rounded-lg p-1.5 md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar url={conv.other_avatar} name={conv.other_name} size={40} online={online} />
        <div className="min-w-0 flex-1">
          <Link to={conv.other_role === 'freelancer' ? `/freelancers/${conv.other_id}` : '#'} className="block truncate font-medium">{conv.other_name}</Link>
          <p className="truncate text-xs text-muted">{typing ? <span className="text-brand">typing…</span> : lastSeen}{conv.order_number && <> · <Link to={`/app/orders/${conv.order_id}`} className="text-brand">{conv.order_number}</Link></>}</p>
        </div>
        <button onClick={() => startCall(conv.conversation_id, 'audio', { id: conv.other_id, name: conv.other_name, avatar: conv.other_avatar })} disabled={blocked}
          className="rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-brand disabled:opacity-40 dark:hover:bg-navy-700" aria-label="Audio call"><Phone className="h-5 w-5" /></button>
        <button onClick={() => startCall(conv.conversation_id, 'video', { id: conv.other_id, name: conv.other_name, avatar: conv.other_avatar })} disabled={blocked}
          className="rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-brand disabled:opacity-40 dark:hover:bg-navy-700" aria-label="Video call"><Video className="h-5 w-5" /></button>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="rounded-xl p-2 text-muted hover:bg-slate-100 dark:hover:bg-navy-700" aria-label="More options"><MoreVertical className="h-5 w-5" /></button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-navy-700 dark:bg-navy-800">
              {profile?.role === 'freelancer' && conv.other_role !== 'freelancer' && <button onClick={() => { setMenu(false); setOfferFor({}); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"><FilePlus2 className="h-4 w-4" />Send custom offer</button>}
              <button onClick={toggleBlock} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"><Ban className="h-4 w-4" />{blocked ? 'Unblock user' : 'Block user'}</button>
              <div className="px-3 py-2"><ReportButton type="user" id={conv.other_id} label="Report user" className="!text-sm !text-navy dark:!text-slate-200" /></div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-navy-700">
        <Search className="h-3.5 w-3.5 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in this conversation" className="h-7 flex-1 bg-transparent text-sm outline-none" aria-label="Search messages" />
        {search && <button onClick={() => setSearch('')} aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
      </div>

      {/* Messages */}
      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 px-3 py-4 dark:bg-navy-900/50 sm:px-5">
        {loading && <div className="flex justify-center py-10"><Spinner /></div>}
        {!loading && hasMore && !search && <div className="text-center"><button onClick={loadOlder} className="text-xs font-medium text-brand">Load earlier messages</button></div>}
        {!loading && msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Say hello 👋 Share your project details, files or a voice note.</p>}
        {shown.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = shown[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const dayLabel = newDay && <div className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">{date(m.created_at)}</div>;
          if (m.kind === 'system') return <div key={m.id}>{dayLabel}<p className="mx-auto max-w-sm rounded-full bg-slate-200/70 px-3 py-1 text-center text-xs text-muted dark:bg-navy-800">{m.body}</p></div>;
          if (m.kind === 'call') {
            const missed = /missed|declined|failed/.test(m.body ?? '');
            return <div key={m.id}>{dayLabel}<p className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-navy-800">
              {missed ? <PhoneMissed className="h-3.5 w-3.5 text-red-500" /> : <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" />}{m.body}<span className="text-muted">{time(m.created_at)}</span></p></div>;
          }
          const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : null;
          const seen = mine && otherRead && new Date(otherRead) >= new Date(m.created_at);
          return (
            <div key={m.id}>
              {dayLabel}
              <div className={cn('group flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                {mine && !m.deleted_at && ['text', 'image', 'file', 'voice'].includes(m.kind) && (
                  <button onClick={() => rpc('delete_my_message', { p_message: m.id }).catch(toast.error)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete message"><Trash2 className="h-3.5 w-3.5 text-muted" /></button>
                )}
                {!m.deleted_at && <button onClick={() => setReplyTo(m)} className={cn('opacity-0 transition group-hover:opacity-100', mine ? 'order-first' : 'order-last')} aria-label="Reply"><Reply className="h-4 w-4 text-muted" /></button>}
                <div className={cn('max-w-[80%] sm:max-w-[65%]', m.kind === 'offer' || m.kind === 'request' ? '' : cn('rounded-2xl px-3.5 py-2', mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white shadow-sm dark:bg-navy-800'))}>
                  {quoted && (
                    <div className={cn('mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs', mine ? 'border-white/60 bg-white/15' : 'border-brand bg-slate-100 dark:bg-navy-900')}>
                      <p className="line-clamp-2 opacity-90">{quoted.body || (quoted.kind === 'voice' ? '🎤 Voice message' : quoted.attachment_name) || 'Message'}</p>
                    </div>
                  )}
                  {m.deleted_at ? <p className="text-sm italic opacity-70">Message deleted</p>
                    : m.kind === 'text' ? <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    : m.kind === 'image' && m.attachment_path ? <ImageMsg path={m.attachment_path} />
                    : m.kind === 'voice' && m.attachment_path ? <VoicePlayer path={m.attachment_path} seconds={m.duration_seconds} mine={mine} />
                    : m.kind === 'file' && m.attachment_path ? (
                      <button onClick={() => openPrivateFile('chat-files', m.attachment_path!).catch(toast.error)} className="flex items-center gap-2 text-left text-sm">
                        <FileText className="h-8 w-8 shrink-0 opacity-80" /><span className="min-w-0"><span className="block truncate font-medium">{m.attachment_name}</span><span className="text-xs opacity-75">{fileSize(m.attachment_size)}</span></span><Download className="h-4 w-4 shrink-0" />
                      </button>
                    ) : m.kind === 'offer' && m.offer_id ? <OfferCard id={m.offer_id} onChanged={refreshList} />
                    : m.kind === 'request' && m.request_id ? <RequestCard id={m.request_id} onMakeOffer={(r) => setOfferFor(r)} />
                    : null}
                  {!['offer', 'request'].includes(m.kind) && (
                    <p className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/75' : 'text-muted')}>
                      {time(m.created_at)}{mine && (seen ? <CheckCheck className="h-3.5 w-3.5" aria-label="Seen" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {typing && <div className="flex gap-1 px-2 py-1">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
      </div>

      {/* Composer */}
      {blocked ? (
        <div className="border-t border-slate-200 p-4 text-center text-sm text-muted dark:border-navy-700">You blocked this user. <button onClick={toggleBlock} className="font-medium text-brand">Unblock</button> to send messages.</div>
      ) : (
        <div className="border-t border-slate-200 p-3 dark:border-navy-700">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs dark:bg-navy-800">
              <Reply className="h-3.5 w-3.5 text-brand" /><span className="line-clamp-1 flex-1">{replyTo.body || replyTo.attachment_name || 'Message'}</span>
              <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {recorder.recording ? (
            <div className="flex items-center gap-3">
              <button onClick={recorder.cancel} className="rounded-xl p-2 text-muted hover:text-red-500" aria-label="Cancel recording"><Trash2 className="h-5 w-5" /></button>
              <span className="flex flex-1 items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />Recording {duration(recorder.secs)}</span>
              <Button onClick={recorder.stop}><Square className="h-4 w-4" />Send</Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <label className="cursor-pointer rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-brand dark:hover:bg-navy-800" aria-label="Attach files">
                <Paperclip className="h-5 w-5" /><input type="file" multiple className="hidden" onChange={(e) => { sendFiles(e.target.files); e.target.value = ''; }} />
              </label>
              <textarea value={text} onChange={(e) => onType(e.target.value)} rows={1} placeholder="Write a message…" maxLength={5000} aria-label="Message"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-navy-700 dark:bg-navy-900" />
              {text.trim() ? (
                <Button onClick={sendText} loading={sending} aria-label="Send"><Send className="h-4 w-4" /></Button>
              ) : (
                <Button variant="outline" onClick={recorder.begin} disabled={sending} aria-label="Record voice message">{sending ? <Spinner className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
              )}
            </div>
          )}
        </div>
      )}
      <OfferModal open={!!offerFor} onClose={() => setOfferFor(null)} conversationId={conv.conversation_id} request={offerFor} />
    </div>
  );
}

function OfferModal({ open, onClose, conversationId, request }: { open: boolean; onClose: () => void; conversationId: string; request: Partial<Request> | null }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', description: '', price: '', days: '3', revisions: '1' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ title: request?.title ?? '', description: request?.description ?? '', price: request?.budget ? String(request.budget) : '', days: '3', revisions: '1' }); }, [open, request]);
  const send = async () => {
    setBusy(true);
    try {
      await rpc('create_custom_offer', { p_conversation: conversationId, p_title: f.title.trim(), p_description: f.description.trim(), p_price: Number(f.price),
        p_delivery_days: Number(f.days), p_revisions: Number(f.revisions), p_request_id: request?.id ?? null });
      toast.success('Offer sent'); onClose();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Send a custom offer" wide>
      <div className="space-y-4">
        <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} required />
        <Textarea label="Scope — what exactly you will deliver" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={3000} required />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Price (PKR)" type="number" min={500} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required />
          <Input label="Delivery (days)" type="number" min={1} max={180} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
          <Input label="Revisions" type="number" min={0} max={20} value={f.revisions} onChange={(e) => setF({ ...f, revisions: e.target.value })} />
        </div>
        <p className="text-xs text-muted">The client pays the price plus a service fee. Platform commission is deducted from your earning. Offers expire after 7 days.</p>
        <Button size="lg" className="w-full" loading={busy} onClick={send}>Send offer</Button>
      </div>
    </Modal>
  );
}

/* ---------- Page ---------- */
export default function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, onlineUsers } = useAuth();
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [found, setFound] = useState<(Message & { conv?: ConversationRow })[] | null>(null);

  const refresh = useCallback(() => { rpc<ConversationRow[]>('get_my_conversations').then(setConvs).catch(() => setConvs([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // refresh list whenever any of my conversations gets a new message
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`convlist:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const searchMessages = async () => {
    if (filter.trim().length < 2) return setFound(null);
    const { data } = await supabase.from('messages').select('*').ilike('body', `%${filter.trim().replace(/[%_]/g, '')}%`).is('deleted_at', null).order('created_at', { ascending: false }).limit(30);
    setFound(((data as Message[]) ?? []).map((m) => ({ ...m, conv: convs?.find((c) => c.conversation_id === m.conversation_id) })));
  };

  const active = convs?.find((c) => c.conversation_id === id);
  const list = (convs ?? []).filter((c) => !filter || c.other_name.toLowerCase().includes(filter.toLowerCase()) || c.order_number?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card className="flex h-[calc(100vh-9.5rem)] min-h-[480px] overflow-hidden">
      <div className={cn('flex w-full flex-col border-r border-slate-200 dark:border-navy-700 md:w-80 md:shrink-0', id && 'hidden md:flex')}>
        <div className="border-b border-slate-200 p-3 dark:border-navy-700">
          <h1 className="mb-2 font-heading text-lg font-semibold">Messages</h1>
          <form onSubmit={(e) => { e.preventDefault(); searchMessages(); }} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={filter} onChange={(e) => { setFilter(e.target.value); if (!e.target.value) setFound(null); }} placeholder="Search people or press Enter for messages"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-navy-700 dark:bg-navy-900" aria-label="Search conversations" />
          </form>
        </div>
        <div className="flex-1 overflow-y-auto">
          {found && (
            <div className="border-b border-slate-200 dark:border-navy-700">
              <p className="px-3 pt-3 text-xs font-semibold uppercase text-muted">Messages matching “{filter}”</p>
              {found.length === 0 && <p className="p-3 text-sm text-muted">No messages found.</p>}
              {found.map((m) => (
                <button key={m.id} onClick={() => { nav(`/app/messages/${m.conversation_id}`); setFound(null); }} className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700/40">
                  <p className="text-xs font-medium">{m.conv?.other_name ?? 'Conversation'} · <span className="text-muted">{timeAgo(m.created_at)}</span></p>
                  <p className="line-clamp-1 text-sm text-muted">{m.body}</p>
                </button>
              ))}
            </div>
          )}
          {!convs && <div className="flex justify-center p-6"><Spinner /></div>}
          {convs?.length === 0 && <div className="p-4"><EmptyState icon={MessageSquare} title="No conversations yet" text="Contact a freelancer from their gig or profile to start chatting." /></div>}
          {list.map((c) => (
            <button key={c.conversation_id} onClick={() => nav(`/app/messages/${c.conversation_id}`)}
              className={cn('flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition dark:border-navy-700/60', c.conversation_id === id ? 'bg-brand-50 dark:bg-brand/10' : 'hover:bg-slate-50 dark:hover:bg-navy-700/40')}>
              <Avatar url={c.other_avatar} name={c.other_name} size={44} online={onlineUsers.has(c.other_id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{c.other_name}</p><span className="shrink-0 text-[11px] text-muted">{timeAgo(c.last_message_at)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-xs', c.unread_count ? 'font-medium text-navy dark:text-white' : 'text-muted')}>
                    {c.order_number && <Briefcase className="mr-1 inline h-3 w-3" />}{c.last_message_preview ?? 'No messages yet'}
                  </p>
                  {c.unread_count > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{c.unread_count}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className={cn('min-w-0 flex-1', !id && 'hidden md:block')}>
        {active ? <Thread key={active.conversation_id} conv={active} onBack={() => nav('/app/messages')} refreshList={refresh} />
          : id && !convs ? <div className="flex h-full items-center justify-center"><Spinner /></div>
          : <div className="flex h-full items-center justify-center p-6"><EmptyState icon={MessageSquare} title={id ? 'Conversation not found' : 'Select a conversation'} text="Messages, files, voice notes and calls all live here." /></div>}
      </div>
    </Card>
  );
}
