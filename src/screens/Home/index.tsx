import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Heart, MessageCircle, Palette, Plus, Sparkles, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import RelationshipTimer from '../../components/RelationshipTimer';
import {
  relationshipDocRef,
  relationshipEmergencyRef,
  relationshipEventsRef,
  relationshipIdFor,
  relationshipMoodsRef,
  relationshipNotesRef,
  type RelationshipEvent,
  type RelationshipMood,
} from '../../services/relationshipRealtime';

type Presence = {
  lastActiveAt?: Timestamp | number | null;
  activity?: 'active' | 'idle' | 'typing' | 'drawing' | 'offline';
  typingUntil?: Timestamp | number | null;
};

type RelationshipRoom = {
  createdAt?: Timestamp | number | null;
  updatedAt?: Timestamp | number | null;
  togetherSince?: Timestamp | number | null;
  presence?: Record<string, Presence>;
};

type Mood = { id: string; emoji: string; label: string };

type EventDraft = {
  title: string;
  emoji: string;
  note: string;
  date: string;
};

const MOODS: Mood[] = [
  { id: 'loving', emoji: '❤️', label: 'Loving' },
  { id: 'missing_you', emoji: '🥺', label: 'Missing You' },
  { id: 'sleepy', emoji: '😴', label: 'Sleepy' },
  { id: 'angry', emoji: '😤', label: 'Angry' },
  { id: 'overthinking', emoji: '😔', label: 'Overthinking' },
  { id: 'jealous', emoji: '😒💚', label: 'Jealous' },
  { id: 'sick', emoji: '🤒', label: 'Sick' },
  { id: 'naughty', emoji: '😈', label: 'Naughty' },
];

const PRESET_EVENTS = [
  { title: 'First Kiss', emoji: '💋', note: 'The first time everything changed.', category: 'first_meet' as const },
  { title: 'Anniversary', emoji: '❤️', note: 'Another year of us.', category: 'anniversary' as const },
  { title: 'First Meet', emoji: '🌅', note: 'The day our story began.', category: 'first_meet' as const },
  { title: 'Promise Day', emoji: '💍', note: 'A promise we keep returning to.', category: 'promise' as const },
];

const QUICK_REACTIONS = ['aww ❤️', 'miss you 🥺', 'idiot 😭'];

const createId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const toMillis = (value: Timestamp | number | null | undefined) => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  if (typeof (value as any).toDate === 'function') return (value as any).toDate().getTime();
  const parsed = new Date(value as any).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const presenceLabel = (presence?: Presence, nowMs = Date.now()) => {
  if (!presence) return 'offline';
  const typingUntil = toMillis(presence.typingUntil as any);
  if (typingUntil > nowMs) return 'typing...';
  const lastActive = toMillis(presence.lastActiveAt as any);
  if (!lastActive) return 'offline';
  const delta = nowMs - lastActive;
  if (delta < 20_000) return 'online now';
  if (delta < 120_000) return `active ${Math.max(1, Math.floor(delta / 60_000))}m ago`;
  if (delta < 3_600_000) return `active ${Math.floor(delta / 60_000)}m ago`;
  return `active ${Math.floor(delta / 3_600_000)}h ago`;
};

const formatCountdown = (eventDate: number) => {
  const diff = eventDate - Date.now();
  if (diff <= 0) return 'passed';
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatPassed = (eventDate: number) => {
  const diff = Date.now() - eventDate;
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  return `${days} days passed`;
};

const Home = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, partnerName } = useAuth();

  const partnerId = userProfile?.partnerId || null;
  const myUid = currentUser?.uid || null;
  const relationshipId = useMemo(() => {
    if (!myUid || !partnerId) return null;
    return relationshipIdFor(myUid, partnerId);
  }, [myUid, partnerId]);

  const roomRef = useMemo(() => (relationshipId ? relationshipDocRef(relationshipId) : null), [relationshipId]);
  const moodsRef = useMemo(() => (relationshipId ? relationshipMoodsRef(relationshipId) : null), [relationshipId]);
  const notesRef = useMemo(() => (relationshipId ? relationshipNotesRef(relationshipId) : null), [relationshipId]);
  const eventsColRef = useMemo(() => (relationshipId ? relationshipEventsRef(relationshipId) : null), [relationshipId]);
  const emergencyColRef = useMemo(() => (relationshipId ? relationshipEmergencyRef(relationshipId) : null), [relationshipId]);

  const [room, setRoom] = useState<RelationshipRoom | null>(null);
  const [moods, setMoods] = useState<Record<string, RelationshipMood>>({});
  const [events, setEvents] = useState<RelationshipEvent[]>([]);
  const [localNote, setLocalNote] = useState('');
  const [noteState, setNoteState] = useState<'idle' | 'typing' | 'saved'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [emergencyPulse, setEmergencyPulse] = useState(false);
  const [togetherSinceDraft, setTogetherSinceDraft] = useState('');
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    title: 'First Kiss',
    emoji: '💋',
    note: 'The first time everything changed.',
    date: '',
  });

  const lastMoodToastRef = useRef<string | null>(null);
  const lastEmergencyIdRef = useRef<string | null>(null);
  const noteDebounceRef = useRef<number | null>(null);
  const noteTypingRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const myMood = myUid ? moods[myUid] : undefined;
  const partnerMood = partnerId ? moods[partnerId] : undefined;
  const partnerPresence = partnerId ? room?.presence?.[partnerId] : undefined;
  const partnerPresenceText = presenceLabel(partnerPresence);
  const displayPartner = partnerName || 'your partner';
  const togetherSinceDate = room?.togetherSince ? new Date(toMillis(room.togetherSince as any)) : null;

  const moodTheme = myMood?.id === 'jealous' || partnerMood?.id === 'jealous'
    ? 'from-emerald-950/30 via-cyan-950/15 to-black'
    : 'from-fuchsia-950/20 via-slate-950/20 to-black';

  const playEmergencyTone = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 220;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.04);
      oscillator.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.05);
      oscillator.stop(ctx.currentTime + 1.1);
    } catch {
      // No-op if audio is blocked.
    }
  };

  useEffect(() => {
    if (!roomRef || !myUid || !partnerId) return;

    const unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(
          roomRef,
          {
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            togetherSince: userProfile?.togetherSince ? Timestamp.fromMillis(userProfile.togetherSince) : null,
            presence: {
              [myUid]: { lastActiveAt: serverTimestamp(), activity: 'active', typingUntil: null },
            },
          },
          { merge: true }
        );
        return;
      }
      setRoom(snap.data() as RelationshipRoom);
    });

    return () => unsub();
  }, [roomRef, myUid, partnerId, userProfile?.togetherSince]);

  useEffect(() => {
    if (!moodsRef || !myUid || !partnerId) return;
    const unsub = onSnapshot(moodsRef, (snap) => {
      const next: Record<string, RelationshipMood> = {};
      snap.docs.forEach((d) => {
        next[d.id] = d.data() as RelationshipMood;
      });
      setMoods(next);
    });
    return () => unsub();
  }, [moodsRef, myUid, partnerId]);

  useEffect(() => {
    if (!notesRef || !myUid || !partnerId) return;
    const unsub = onSnapshot(notesRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { text?: string };
      if (noteState !== 'typing') {
        setLocalNote(data.text || '');
      }
    });
    return () => unsub();
  }, [notesRef, myUid, partnerId, noteState]);

  useEffect(() => {
    if (!eventsColRef || !myUid || !partnerId) return;
    const q = query(eventsColRef, orderBy('eventDate', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => d.data() as RelationshipEvent);
      setEvents(next);
    });
    return () => unsub();
  }, [eventsColRef, myUid, partnerId]);

  useEffect(() => {
    if (!emergencyColRef || !myUid || !partnerId) return;
    const q = query(emergencyColRef, orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      const newest = snap.docs[0]?.data() as any;
      if (!newest?.id || newest.from === myUid || newest.id === lastEmergencyIdRef.current) return;
      lastEmergencyIdRef.current = newest.id;
      setEmergencyPulse(true);
      playEmergencyTone();
      setToast('I NEED YOU RIGHT NOW ❤️');
      window.setTimeout(() => setEmergencyPulse(false), 4200);
      window.setTimeout(() => setToast(null), 2600);
    });
    return () => unsub();
  }, [emergencyColRef, myUid, partnerId]);

  useEffect(() => {
    if (!roomRef || !myUid) return;

    const beat = () => {
      const hidden = document.visibilityState === 'hidden';
      setDoc(
        roomRef,
        {
          updatedAt: serverTimestamp(),
          [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
          [`presence.${myUid}.activity`]: noteState === 'typing' ? 'typing' : hidden ? 'idle' : 'active',
        },
        { merge: true }
      );
    };

    beat();
    const interval = window.setInterval(beat, 8000);
    const onVis = () => beat();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [roomRef, myUid, noteState]);

  useEffect(() => {
    if (!partnerMood) return;
    const message = partnerMood.id === 'jealous'
      ? `Your partner feels jealous 😒💚`
      : `Your partner feels ${partnerMood.label.toLowerCase()} ${partnerMood.emoji}`;
    if (message !== lastMoodToastRef.current) {
      lastMoodToastRef.current = message;
      setToast(message);
      const timer = window.setTimeout(() => setToast(null), 2600);
      return () => window.clearTimeout(timer);
    }
  }, [partnerMood]);

  const setPresence = async (activity: Presence['activity']) => {
    if (!roomRef || !myUid) return;
    await setDoc(
      roomRef,
      {
        updatedAt: serverTimestamp(),
        [`presence.${myUid}.activity`]: activity,
        [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const setMood = async (mood: Mood) => {
    if (!relationshipId || !myUid || !moodsRef || !roomRef) return;
    await Promise.all([
      setDoc(
        doc(db, 'relationships', relationshipId, 'moods', myUid),
        {
          userId: myUid,
          id: mood.id,
          emoji: mood.emoji,
          label: mood.label,
          updatedAt: Date.now(),
        },
        { merge: true }
      ),
      setPresence('active'),
    ]);
  };

  const saveNote = (value: string) => {
    setLocalNote(value);
    setNoteState(value.trim() ? 'typing' : 'idle');
    if (!roomRef || !myUid || !notesRef) return;

    setDoc(
      roomRef,
      {
        [`presence.${myUid}.typingUntil`]: Timestamp.fromMillis(Date.now() + 2200),
        [`presence.${myUid}.activity`]: value.trim() ? 'typing' : 'active',
        [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
      },
      { merge: true }
    );

    if (noteDebounceRef.current) window.clearTimeout(noteDebounceRef.current);
    if (noteTypingRef.current) window.clearTimeout(noteTypingRef.current);
    noteDebounceRef.current = window.setTimeout(async () => {
      await setDoc(
        notesRef,
        {
          text: value,
          updatedAt: serverTimestamp(),
          updatedBy: myUid,
        },
        { merge: true }
      );
      setNoteState('saved');
      noteTypingRef.current = window.setTimeout(() => setNoteState('idle'), 1200);
    }, 160);
  };

  const setTogetherSince = async (date: Date) => {
    if (!roomRef || !myUid || !eventsColRef) return;
    const togetherTs = Timestamp.fromDate(date);
    await Promise.all([
      setDoc(roomRef, { togetherSince: togetherTs, updatedAt: serverTimestamp() }, { merge: true }),
      addDoc(eventsColRef, {
        id: createId(),
        title: 'Together Since',
        emoji: '💞',
        note: 'The day everything became us.',
        eventDate: date.getTime(),
        createdAt: Date.now(),
        createdBy: myUid,
        category: 'anniversary',
      }),
    ]);
  };

  const addEvent = async () => {
    if (!eventsColRef || !myUid) return;
    const date = new Date(eventDraft.date);
    if (!Number.isFinite(date.getTime())) return;
    await addDoc(eventsColRef, {
      id: createId(),
      title: eventDraft.title.trim() || 'A moment',
      emoji: eventDraft.emoji.trim() || '✨',
      note: eventDraft.note.trim(),
      eventDate: date.getTime(),
      createdAt: Date.now(),
      createdBy: myUid,
      category: 'custom',
    });
    setShowEventModal(false);
    setEventDraft({ title: 'First Kiss', emoji: '💋', note: 'The first time everything changed.', date: '' });
  };

  const addPresetEvent = async (preset: (typeof PRESET_EVENTS)[number]) => {
    if (!eventsColRef || !myUid) return;
    await addDoc(eventsColRef, {
      id: createId(),
      title: preset.title,
      emoji: preset.emoji,
      note: preset.note,
      eventDate: Date.now(),
      createdAt: Date.now(),
      createdBy: myUid,
      category: preset.category,
    });
  };

  const sendEmergency = async () => {
    if (!emergencyColRef || !myUid) return;
    const id = createId();
    await addDoc(emergencyColRef, {
      id,
      text: 'I NEED YOU RIGHT NOW ❤️',
      from: myUid,
      createdAt: Date.now(),
    });
    setEmergencyPulse(true);
    playEmergencyTone();
    setTimeout(() => setEmergencyPulse(false), 3500);
  };

  const eventCards = events
    .slice()
    .sort((a, b) => b.eventDate - a.eventDate)
    .map((event) => ({
      ...event,
      countdown: event.eventDate > Date.now() ? formatCountdown(event.eventDate) : formatPassed(event.eventDate),
      isFuture: event.eventDate > Date.now(),
    }));

  return (
    <div className="relative min-h-screen overflow-hidden pb-28 text-white">
      <div className={`absolute inset-0 bg-gradient-to-br ${moodTheme}`} />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: emergencyPulse ? [0.35, 0.95, 0.35] : [0.25, 0.45, 0.25] }}
        transition={{ duration: emergencyPulse ? 1.2 : 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(255,0,229,0.12), transparent 55%), radial-gradient(circle at 75% 35%, rgba(0,240,255,0.12), transparent 58%), radial-gradient(circle at 50% 100%, rgba(255,145,0,0.08), transparent 45%)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.55)_100%)]" />

      <AnimatePresence>
        {!!toast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="fixed top-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="rounded-full border border-white/12 bg-black/60 px-4 py-2 text-xs text-white/80 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,240,255,0.12)]">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {emergencyPulse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 pointer-events-none">
            <motion.div
              className="absolute inset-0 bg-red-500/15"
              animate={{ opacity: [0.25, 0.75, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-20 w-[min(420px,90vw)] -translate-x-1/2 rounded-3xl border border-red-400/30 bg-black/55 p-6 text-center backdrop-blur-2xl"
              initial={{ scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
            >
              <motion.div animate={{ scale: [1, 1.16, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className="text-4xl">
                ❤️
              </motion.div>
              <div className="mt-3 text-xl font-light tracking-wide">I NEED YOU RIGHT NOW ❤️</div>
              <div className="mt-1 text-xs uppercase tracking-[0.26em] text-white/45">Emergency love signal sent</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={sendEmergency}
        className="fixed bottom-28 right-5 z-50 grid h-16 w-16 place-items-center rounded-full border border-red-400/30 bg-gradient-to-br from-red-500 to-pink-500 text-white shadow-[0_0_45px_rgba(255,55,95,0.38)]"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Heart className="h-7 w-7 fill-white" />
      </motion.button>

      <div className="relative z-10 px-5 pt-8">
        <div className="mb-8 flex items-center justify-between rounded-full border border-white/8 bg-black/35 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-2.5 w-2.5 rounded-full"
              style={{ boxShadow: '0 0 15px rgba(0,240,255,0.55)', backgroundColor: partnerPresenceText === 'offline' ? '#FF00E5' : '#00F0FF' }}
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="text-sm font-light text-white/72">{displayPartner} {partnerPresenceText}</div>
          </div>
          <button onClick={() => navigate('/profile')} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65 transition">
            Profile
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-8">
          <RelationshipTimer togetherSince={togetherSinceDate} onSetTogetherSince={() => setShowEventModal(true)} />
        </motion.div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,240,255,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/35">Live Mood Sync</div>
                <div className="mt-1 text-sm text-white/70">{partnerMood ? `Your partner feels ${partnerMood.id === 'jealous' ? 'jealous 😒💚' : `${partnerMood.label.toLowerCase()} ${partnerMood.emoji}`}` : `Waiting for ${displayPartner}`}</div>
              </div>
              <button onClick={() => navigate('/mood')} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                Open moods
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MOODS.map((mood) => {
                const selected = myMood?.id === mood.id;
                return (
                  <motion.button
                    key={mood.id}
                    type="button"
                    onClick={() => setMood(mood)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className={[
                      'relative overflow-hidden rounded-3xl border px-4 py-4 text-left backdrop-blur-2xl transition',
                      selected ? 'border-white/25 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-white/72',
                      mood.id === 'jealous' ? 'ring-1 ring-emerald-400/20' : '',
                    ].join(' ')}
                  >
                    <motion.span className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} animate={{ x: ['-120%', '120%'] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }} />
                    <div className="relative z-10 flex flex-col gap-2">
                      <motion.div animate={selected ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 1.5, repeat: selected ? Infinity : 0 }} className="text-2xl">
                        {mood.emoji}
                      </motion.div>
                      <div className="text-[13px] font-light tracking-wide">{mood.label}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/35">Shared Notes</div>
                <div className="mt-1 text-sm text-white/70">{partnerPresenceText === 'typing...' ? 'Partner is typing...' : noteState === 'typing' ? 'Typing...' : noteState === 'saved' ? 'Saved just now' : `Live with ${displayPartner}`}</div>
              </div>
              <MessageCircle className="h-5 w-5 text-cyan-300/80" />
            </div>
            <textarea
              value={localNote}
              onChange={(e) => saveNote(e.target.value)}
              placeholder="thinking about you..."
              rows={5}
              className="w-full resize-none rounded-[1.6rem] border border-white/10 bg-black/35 px-4 py-4 text-white/85 outline-none placeholder:text-white/25 caret-cyan-300"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Auto-saves on every keystroke</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Partner synced</span>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-white/35">Special Date Timeline</div>
              <div className="mt-1 text-sm text-white/70">Beautiful shared memories with live countdowns</div>
            </div>
            <button onClick={() => setShowEventModal(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <Plus className="h-4 w-4" /> Add event
            </button>
          </div>

          <div className="space-y-3">
            {eventCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/25 px-4 py-6 text-center text-sm text-white/40">
                No special events yet. Add First Kiss, Anniversary, First Meet, or a custom memory.
              </div>
            ) : (
              eventCards.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/28 p-4"
                >
                  <div className="absolute left-4 top-4 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-cyan-300/60 via-fuchsia-300/30 to-transparent" />
                  <div className="relative z-10 flex gap-4 pl-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl shadow-[0_0_25px_rgba(0,240,255,0.06)]">
                      {event.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-medium text-white">{event.title}</div>
                          {!!event.note && <div className="mt-1 text-sm text-white/50">{event.note}</div>}
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${event.isFuture ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' : 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100'}`}>
                          {event.countdown}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(event.eventDate).toLocaleDateString()}</span>
                        <span>{event.isFuture ? 'Countdown live' : formatPassed(event.eventDate)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center gap-4">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/canvas')} className="grid h-16 w-16 place-items-center rounded-full border border-white/12 bg-white/7 text-white/70 backdrop-blur-2xl">
            <Palette className="h-6 w-6" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/mood')} className="grid h-16 w-16 place-items-center rounded-full border border-white/12 bg-white/7 text-white/70 backdrop-blur-2xl">
            <Sparkles className="h-6 w-6" />
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showEventModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/75" onClick={() => setShowEventModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="absolute left-1/2 top-1/2 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/10 bg-[#06060a]/90 p-6 backdrop-blur-2xl"
            >
              <div className="text-xl font-light text-white">Add a special event</div>
              <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">Shared timeline card</div>

              <div className="mt-5 rounded-[1.6rem] border border-cyan-400/15 bg-cyan-400/8 p-4">
                <div className="text-sm text-white/80">Set together since</div>
                <div className="mt-1 text-xs text-white/45">This powers the live relationship timer.</div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="datetime-local"
                    value={togetherSinceDraft}
                    onChange={(e) => setTogetherSinceDraft(e.target.value)}
                    className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!togetherSinceDraft) return;
                      const date = new Date(togetherSinceDraft);
                      if (Number.isFinite(date.getTime())) {
                        await setTogetherSince(date);
                        setShowEventModal(false);
                        setTogetherSinceDraft('');
                      }
                    }}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs text-cyan-100"
                  >
                    Save start date
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {PRESET_EVENTS.map((preset) => (
                  <button key={preset.title} type="button" onClick={() => addPresetEvent(preset)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition active:scale-95">
                    {preset.emoji} {preset.title}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-[72px_1fr] gap-3">
                  <input value={eventDraft.emoji} onChange={(e) => setEventDraft((prev) => ({ ...prev, emoji: e.target.value }))} maxLength={3} className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-2xl outline-none" />
                  <input value={eventDraft.title} onChange={(e) => setEventDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Event title" className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
                </div>
                <textarea value={eventDraft.note} onChange={(e) => setEventDraft((prev) => ({ ...prev, note: e.target.value }))} rows={3} placeholder="Custom note" className="w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25" />
                <input type="datetime-local" value={eventDraft.date} onChange={(e) => setEventDraft((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none" />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEventModal(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
                  Cancel
                </button>
                <button type="button" onClick={addEvent} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-100">
                  Save event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
