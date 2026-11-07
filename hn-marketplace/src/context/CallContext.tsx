import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { Avatar } from '@/components/ui';
import { duration } from '@/lib/utils';

type Media = 'audio' | 'video';
interface Peer { id: string; name: string; avatar: string | null }
interface CallState {
  id: string; conversationId: string; media: Media; role: 'caller' | 'callee'; peer: Peer;
  phase: 'incoming' | 'ringing' | 'connecting' | 'connected';
}
interface CallCtx { startCall: (conversationId: string, media: Media, peer: Peer) => Promise<void>; inCall: boolean }
const Ctx = createContext<CallCtx>(null!);

const DEFAULT_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let iceCache: { servers: RTCIceServer[]; exp: number } | null = null;

/** TURN credentials come from the `turn-credentials` edge function so secrets never ship to the browser. */
async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && iceCache.exp > Date.now()) return iceCache.servers;
  try {
    const { data, error } = await supabase.functions.invoke('turn-credentials');
    if (error || !data?.iceServers) throw error;
    iceCache = { servers: data.iceServers, exp: Date.now() + 30 * 60_000 };
    return data.iceServers;
  } catch {
    return DEFAULT_ICE; // STUN only: works on most home networks, may fail behind strict NAT
  }
}

function mediaError(e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === 'NotAllowedError') return 'Microphone/camera permission was denied. Allow access in your browser settings and try again.';
  if (name === 'NotFoundError') return 'No microphone or camera was found on this device.';
  if (name === 'NotReadableError') return 'Your microphone or camera is being used by another app.';
  if (!window.isSecureContext) return 'Calls need a secure (https) connection.';
  return 'Could not access microphone/camera.';
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [call, setCall] = useState<CallState | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const callRef = useRef<CallState | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<RTCChannelLike | null>(null);
  const dbChanRef = useRef<RealtimeChannel | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const timers = useRef<number[]>([]);
  const startedAt = useRef<number | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const ringtone = useRef<{ stop: () => void } | null>(null);

  type RTCChannelLike = RealtimeChannel;
  useEffect(() => { callRef.current = call; }, [call]);

  const attach = useCallback(() => {
    if (localVideo.current && localRef.current) localVideo.current.srcObject = localRef.current;
    if (remoteVideo.current && remoteRef.current) remoteVideo.current.srcObject = remoteRef.current;
    if (remoteAudio.current && remoteRef.current) remoteAudio.current.srcObject = remoteRef.current;
  }, []);
  useEffect(attach, [call?.phase, hasRemoteVideo, attach]);

  const cleanup = useCallback(() => {
    ringtone.current?.stop(); ringtone.current = null;
    timers.current.forEach((t) => clearTimeout(t)); timers.current = [];
    pcRef.current?.close(); pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop()); localRef.current = null;
    remoteRef.current = null; iceQueue.current = []; startedAt.current = null;
    if (chanRef.current) supabase.removeChannel(chanRef.current); chanRef.current = null;
    if (dbChanRef.current) supabase.removeChannel(dbChanRef.current); dbChanRef.current = null;
    setCall(null); setMuted(false); setCamOff(false); setElapsed(0); setHasRemoteVideo(false);
  }, []);

  const end = useCallback(async (status: 'ended' | 'rejected' | 'failed' = 'ended', reason?: string) => {
    const c = callRef.current;
    if (!c) return;
    chanRef.current?.send({ type: 'broadcast', event: 'hangup', payload: {} });
    cleanup();
    try { await rpc('update_call', { p_call: c.id, p_status: status, p_reason: reason ?? null }); } catch { /* already finished */ }
  }, [cleanup]);

  // timer while connected
  useEffect(() => {
    if (call?.phase !== 'connected') return;
    const t = setInterval(() => setElapsed(startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0), 1000);
    return () => clearInterval(t);
  }, [call?.phase]);

  const sendSignal = (event: string, payload: Record<string, unknown>) => chanRef.current?.send({ type: 'broadcast', event, payload });

  const createPeer = async () => {
    const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
    pcRef.current = pc;
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
    remoteRef.current = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remoteRef.current!.addTrack(t));
      if (e.track.kind === 'video') setHasRemoteVideo(true);
      attach();
    };
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal('ice', { candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        startedAt.current = Date.now();
        setCall((c) => (c ? { ...c, phase: 'connected' } : c));
      } else if (pc.connectionState === 'failed') {
        toast.error('Call connection failed. A TURN server may be needed on this network.');
        end('failed', 'ice_failed');
      }
    };
    return pc;
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    for (const c of iceQueue.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  };

  const joinSignaling = (callId: string, onReady?: () => void) => {
    const ch = supabase.channel(`call:${callId}`, { config: { private: true, broadcast: { self: false } } });
    ch.on('broadcast', { event: 'ready' }, async () => {
      if (callRef.current?.role !== 'caller' || pcRef.current) return;
      setCall((c) => (c ? { ...c, phase: 'connecting' } : c));
      ringtone.current?.stop();
      const pc = await createPeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('offer', { sdp: offer });
    })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (callRef.current?.role !== 'callee') return;
        const pc = pcRef.current ?? (await createPeer());
        await pc.setRemoteDescription(payload.sdp);
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal('answer', { sdp: answer });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        await pcRef.current?.setRemoteDescription(payload.sdp);
        await flushIce();
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(payload.candidate).catch(() => {});
        else iceQueue.current.push(payload.candidate);
      })
      .on('broadcast', { event: 'hangup' }, () => { toast.info('Call ended'); cleanup(); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') onReady?.(); });
    chanRef.current = ch;
  };

  /** Watch the call row so the other side's reject/cancel/missed is seen even before signaling connects. */
  const watchRow = (callId: string) => {
    dbChanRef.current = supabase.channel(`callrow:${callId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` }, ({ new: row }) => {
        const s = (row as { status: string }).status;
        if (['rejected', 'missed', 'ended', 'failed'].includes(s) && callRef.current?.id === callId) {
          toast.info(s === 'rejected' ? 'Call declined' : s === 'missed' ? (callRef.current.role === 'caller' ? 'No answer' : 'Missed call') : 'Call ended');
          cleanup();
        }
      }).subscribe();
  };

  const getMedia = (media: Media) => navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: media === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
  });

  const startCall = async (conversationId: string, media: Media, peer: Peer) => {
    if (callRef.current) return toast.error('You are already in a call');
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') return toast.error('Your browser does not support calls');
    try { localRef.current = await getMedia(media); } catch (e) { return toast.error(mediaError(e)); }
    let id: string;
    try { id = await rpc<string>('start_call', { p_conversation: conversationId, p_media: media }); }
    catch (e) { localRef.current?.getTracks().forEach((t) => t.stop()); localRef.current = null; return toast.error(e); }
    const state: CallState = { id, conversationId, media, role: 'caller', peer, phase: 'ringing' };
    callRef.current = state; setCall(state);
    ringtone.current = tone(440, 480);
    joinSignaling(id);
    watchRow(id);
    timers.current.push(window.setTimeout(() => { if (callRef.current?.id === id && callRef.current.phase === 'ringing') { toast.info('No answer'); end('ended', 'no_answer'); } }, 45_000));
  };

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    ringtone.current?.stop();
    try { localRef.current = await getMedia(c.media); } catch (e) { toast.error(mediaError(e)); return end('failed', 'media_denied'); }
    try { await rpc('update_call', { p_call: c.id, p_status: 'accepted' }); } catch (e) { toast.error(e); return cleanup(); }
    setCall({ ...c, phase: 'connecting' });
    joinSignaling(c.id, () => sendSignal('ready', {}));
    timers.current.push(window.setTimeout(() => { if (callRef.current?.phase === 'connecting') { toast.error('Could not connect the call'); end('failed', 'connect_timeout'); } }, 30_000));
  };

  // Incoming calls
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`incoming:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, async ({ new: row }) => {
        const r = row as { id: string; conversation_id: string; caller_id: string; media: Media; created_at: string };
        if (callRef.current) { await rpc('update_call', { p_call: r.id, p_status: 'rejected', p_reason: 'busy' }).catch(() => {}); return; }
        const { data: p } = await supabase.from('profiles').select('id,full_name,avatar_url').eq('id', r.caller_id).single();
        const state: CallState = { id: r.id, conversationId: r.conversation_id, media: r.media, role: 'callee', phase: 'incoming',
          peer: { id: r.caller_id, name: p?.full_name ?? 'Someone', avatar: p?.avatar_url ?? null } };
        callRef.current = state; setCall(state);
        ringtone.current = tone(660, 880);
        watchRow(r.id);
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(`Incoming ${r.media} call`, { body: state.peer.name });
        }
        timers.current.push(window.setTimeout(() => { if (callRef.current?.id === r.id && callRef.current.phase === 'incoming') cleanup(); }, 50_000));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // End the call if the tab closes
  useEffect(() => {
    const h = () => { const c = callRef.current; if (c) { chanRef.current?.send({ type: 'broadcast', event: 'hangup', payload: {} }); } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const toggleMute = () => { localRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); };
  const toggleCam = () => { localRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); };

  return (
    <Ctx.Provider value={{ startCall, inCall: !!call }}>
      {children}
      {call && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/90 p-0 backdrop-blur sm:p-6" role="dialog" aria-label="Call">
          <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-navy-900 text-white sm:h-[min(640px,90vh)] sm:rounded-3xl">
            <audio ref={remoteAudio} autoPlay />
            {call.media === 'video' && call.phase === 'connected' && hasRemoteVideo ? (
              <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full bg-black object-cover" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className={call.phase !== 'connected' ? 'animate-pulse' : ''}><Avatar url={call.peer.avatar} name={call.peer.name} size={112} /></div>
                <p className="font-heading text-2xl font-semibold">{call.peer.name}</p>
                <p className="flex items-center gap-2 text-slate-300">
                  {call.phase === 'incoming' && `Incoming ${call.media} call…`}
                  {call.phase === 'ringing' && 'Ringing…'}
                  {call.phase === 'connecting' && <><Loader2 className="h-4 w-4 animate-spin" />Connecting…</>}
                  {call.phase === 'connected' && duration(elapsed)}
                </p>
              </div>
            )}
            {call.media === 'video' && call.phase !== 'incoming' && (
              <video ref={localVideo} autoPlay playsInline muted className="absolute right-4 top-4 z-10 h-32 w-24 rounded-2xl border-2 border-white/20 bg-black object-cover sm:h-40 sm:w-56" style={{ transform: 'scaleX(-1)' }} />
            )}
            {call.phase === 'connected' && call.media === 'video' && hasRemoteVideo && (
              <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-sm">{call.peer.name} · {duration(elapsed)}</div>
            )}
            <div className="relative z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-6">
              {call.phase === 'incoming' ? (
                <>
                  <button onClick={() => end('rejected')} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-700" aria-label="Decline"><PhoneOff className="h-6 w-6" /></button>
                  <button onClick={accept} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600" aria-label="Accept">{call.media === 'video' ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}</button>
                </>
              ) : (
                <>
                  <button onClick={toggleMute} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
                  {call.media === 'video' && <button onClick={toggleCam} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={camOff ? 'Camera on' : 'Camera off'}>{camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>}
                  <button onClick={() => end('ended')} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-700" aria-label="End call"><PhoneOff className="h-6 w-6" /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Simple two-tone ring generated with WebAudio (no audio files needed). */
function tone(f1: number, f2: number): { stop: () => void } {
  try {
    const ctx = new AudioContext();
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      [f1, f2].forEach((f) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = f; g.gain.value = 0.04;
        o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.8);
      });
    };
    ring();
    const t = setInterval(ring, 2500);
    return { stop: () => { stopped = true; clearInterval(t); ctx.close().catch(() => {}); } };
  } catch { return { stop: () => {} }; }
}

export const useCall = () => useContext(Ctx);
