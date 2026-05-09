import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Heart, MessageCircle, Palette } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Timestamp, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import RelationshipTimer from '../../components/RelationshipTimer';

type Mood = {
  id: string;
  emoji: string;
  label: string;
  vibe: 'warm' | 'cool' | 'sad' | 'sleepy' | 'intense';
};

const MOODS: Mood[] = [
  { id: 'love', emoji: '❤️', label: 'Love', vibe: 'warm' },
  { id: 'missing', emoji: '🥺', label: 'Missing You', vibe: 'sad' },
  { id: 'sleepy', emoji: '😴', label: 'Sleepy', vibe: 'sleepy' },
  { id: 'angry', emoji: '😡', label: 'Angry', vibe: 'intense' },
  { id: 'hug', emoji: '🤗', label: 'Need Hug', vibe: 'warm' },
  { id: 'cry', emoji: '😭', label: 'Crying', vibe: 'sad' },
  { id: 'obsessed', emoji: '😍', label: 'Obsessed', vibe: 'warm' },
  { id: 'kiss', emoji: '😚', label: 'Kiss', vibe: 'warm' },
  { id: 'overthinking', emoji: '😵', label: 'Overthinking', vibe: 'cool' },
];

type Presence = {
  lastActiveAt?: Timestamp | null | any;
  activity?: 'active' | 'idle' | 'typing' | 'drawing' | 'offline';
  typingUntil?: Timestamp | null | any;
};

type RelationshipRoom = {
  createdAt?: Timestamp | null | any;
  updatedAt?: Timestamp | null | any;
  togetherSince?: Timestamp | null | any;
  participants?: string[];
  moods?: Record<string, { id: string; emoji: string; label: string; changedAt?: Timestamp | null }>;
  notes?: { text?: string; updatedAt?: Timestamp | null | any; updatedBy?: string | null };
  presence?: Record<string, Presence>;
  lastMoodEvent?: { text: string; at?: Timestamp | null | any };
  emergency?: { text: string; from: string; at?: Timestamp | null | any; id: string };
  moments?: Record<
    string,
    {
      id: string;
      emoji?: string;
      title: string;
      at?: Timestamp | null | any;
      date?: Timestamp | null | any;
      note?: string;
      createdAt?: Timestamp | null | any;
      createdBy?: string | null;
    }
  >;
  // legacy: older builds used `dates`
  dates?: Record<string, any>;
};

function relationshipIdFor(a: string, b: string) {
  return [a, b].sort().join('_');
}

function nowIsoId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function tsToMs(ts?: Timestamp | null) {
  if (!ts) return 0;
  return ts.toMillis();
}

function presenceLabel(p?: Presence, nowMs = Date.now()) {
  const last = tsToMs(p?.lastActiveAt);
  const ago = last ? nowMs - last : Infinity;
  const typingUntil = tsToMs(p?.typingUntil);
  const typing = typingUntil && typingUntil > nowMs;

  if (typing) return 'typing…';
  if (p?.activity === 'drawing') return 'drawing…';
  if (ago < 18_000) return 'online now';
  if (ago < 120_000) return `active ${Math.max(1, Math.floor(ago / 60_000))}m ago`;
  if (ago < 3_600_000) return `active ${Math.floor(ago / 60_000)}m ago`;
  if (ago < 86_400_000) return `active ${Math.floor(ago / 3_600_000)}h ago`;
  return 'offline';
}

function vibeToBg(vibe: Mood['vibe']) {
  switch (vibe) {
    case 'warm':
      return 'from-amber-900/20 via-orange-800/10 to-pink-900/25';
    case 'sad':
      return 'from-blue-950/25 via-indigo-950/20 to-transparent';
    case 'sleepy':
      return 'from-indigo-950/25 via-purple-950/15 to-transparent';
    case 'cool':
      return 'from-cyan-950/20 via-slate-950/10 to-transparent';
    case 'intense':
      return 'from-red-950/25 via-pink-950/15 to-transparent';
  }
}

const Home = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, partnerName } = useAuth();

  const [room, setRoom] = useState<RelationshipRoom | null>(null);
  const [localNote, setLocalNote] = useState('');
  const [savingState, setSavingState] = useState<'idle' | 'typing' | 'saved'>('idle');
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateDraft, setDateDraft] = useState<string>(''); // datetime-local string
  const [momentEmojiDraft, setMomentEmojiDraft] = useState<string>('✨');
  const [momentTitleDraft, setMomentTitleDraft] = useState<string>('first time you said i love you');
  const [momentNoteDraft, setMomentNoteDraft] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [emergencyPulse, setEmergencyPulse] = useState(false);

  const lastSeenEmergencyIdRef = useRef<string | null>(null);
  const lastMoodTextRef = useRef<string | null>(null);
  const noteSaveTimerRef = useRef<number | null>(null);

  const partnerId = userProfile?.partnerId || null;
  const relationshipId = useMemo(() => {
    if (!currentUser?.uid || !partnerId) return null;
    return relationshipIdFor(currentUser.uid, partnerId);
  }, [currentUser?.uid, partnerId]);

  const roomRef = useMemo(() => {
    if (!relationshipId) return null;
    return doc(db, 'relationships', relationshipId);
  }, [relationshipId]);

  const myUid = currentUser?.uid || null;
  const partnerUid = partnerId;
  const displayPartner = partnerName || 'your partner';

  const myMood = myUid ? room?.moods?.[myUid] : undefined;
  const partnerMood = partnerUid ? room?.moods?.[partnerUid] : undefined;
  const partnerPresence = partnerUid ? room?.presence?.[partnerUid] : undefined;

  const moodVibe = useMemo(() => {
    const mood = (myMood?.id && MOODS.find((m) => m.id === myMood.id)) || MOODS[0];
    return mood.vibe;
  }, [myMood?.id]);

  // Room subscription (single source of truth).
  useEffect(() => {
    if (!roomRef || !myUid || !partnerUid) return;

    const unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(
          roomRef,
          {
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            participants: [myUid, partnerUid],
            togetherSince: userProfile?.togetherSince ? Timestamp.fromMillis(userProfile.togetherSince) : null,
            presence: {
              [myUid]: { lastActiveAt: serverTimestamp(), activity: 'active', typingUntil: null },
            },
          },
          { merge: true }
        );
        return;
      }

      const data = snap.data() as RelationshipRoom;
      setRoom(data);

      // Mood event toast
      if (data.lastMoodEvent?.text && data.lastMoodEvent.text !== lastMoodTextRef.current) {
        lastMoodTextRef.current = data.lastMoodEvent.text;
        setToast(data.lastMoodEvent.text);
        window.setTimeout(() => setToast(null), 2600);
      }

      // Emergency pulse (show once per emergency id)
      const emergency = data.emergency;
      if (emergency?.id && emergency.id !== lastSeenEmergencyIdRef.current && emergency.from !== myUid) {
        lastSeenEmergencyIdRef.current = emergency.id;
        setEmergencyPulse(true);
        window.setTimeout(() => setEmergencyPulse(false), 4500);
      }

      // Keep local note in sync (partner edits)
      const remoteText = data.notes?.text ?? '';
      setLocalNote((prev) => (savingState === 'typing' ? prev : remoteText));
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomRef, myUid, partnerUid]);

  // Presence heartbeat (real, not random).
  useEffect(() => {
    if (!roomRef || !myUid) return;

    const beat = () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      setDoc(
        roomRef,
        {
        updatedAt: serverTimestamp(),
        [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
        [`presence.${myUid}.activity`]: isHidden ? 'idle' : savingState === 'typing' ? 'typing' : 'active',
        },
        { merge: true }
      );
    };

    beat();
    const i = window.setInterval(beat, 8000);
    const onVis = () => beat();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(i);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [roomRef, myUid, savingState]);

  const setTogetherSince = async (d: Date) => {
    if (!roomRef) return;
    const ts = Timestamp.fromDate(d);
    await setDoc(
      roomRef,
      {
        togetherSince: ts,
        updatedAt: serverTimestamp(),
        moments: {
          togetherSince: {
            id: 'togetherSince',
            emoji: '💞',
            title: 'The day we became official',
            at: ts,
            note: 'The moment our story started.',
            createdAt: serverTimestamp(),
            createdBy: myUid,
          },
        },
      },
      { merge: true }
    );
  };

  const addMoment = async (moment: { emoji?: string; title: string; at: Date; note?: string }) => {
    if (!roomRef || !myUid) return;
    const id = nowIsoId();
    await setDoc(
      roomRef,
      {
        updatedAt: serverTimestamp(),
        moments: {
          [id]: {
            id,
            emoji: (moment.emoji || '').trim(),
            title: moment.title.trim() || 'A moment',
            at: Timestamp.fromDate(moment.at),
            note: (moment.note || '').trim(),
            createdAt: serverTimestamp(),
            createdBy: myUid,
          },
        },
      },
      { merge: true }
    );
  };

  const removeMoment = async (id: string) => {
    if (!roomRef) return;
    await setDoc(roomRef, { updatedAt: serverTimestamp(), [`moments.${id}`]: deleteField() }, { merge: true });
  };

  const changeMood = async (m: Mood) => {
    if (!roomRef || !myUid) return;
    await setDoc(
      roomRef,
      {
      updatedAt: serverTimestamp(),
      [`moods.${myUid}`]: { id: m.id, emoji: m.emoji, label: m.label, changedAt: serverTimestamp() },
      lastMoodEvent: {
        text: `Krisha changed mood to ${m.emoji} ${m.label}`,
        at: serverTimestamp(),
      },
      [`presence.${myUid}.activity`]: 'active',
      [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const sendEmergency = async () => {
    if (!roomRef || !myUid) return;
    const id = nowIsoId();
    await setDoc(
      roomRef,
      {
      updatedAt: serverTimestamp(),
      emergency: { text: 'I NEED YOU RIGHT NOW ❤️', from: myUid, at: serverTimestamp(), id },
      [`presence.${myUid}.activity`]: 'active',
      [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
      },
      { merge: true }
    );
    setEmergencyPulse(true);
    window.setTimeout(() => setEmergencyPulse(false), 2500);
  };

  const onNoteChange = (value: string) => {
    setLocalNote(value);
    setSavingState(value.length ? 'typing' : 'idle');

    if (!roomRef || !myUid) return;

    // typing indicator
    setDoc(
      roomRef,
      {
      [`presence.${myUid}.typingUntil`]: Timestamp.fromMillis(Date.now() + 2500),
      [`presence.${myUid}.activity`]: value.length ? 'typing' : 'active',
      [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
      },
      { merge: true }
    );

    if (noteSaveTimerRef.current) window.clearTimeout(noteSaveTimerRef.current);
    noteSaveTimerRef.current = window.setTimeout(async () => {
      await setDoc(
        roomRef,
        {
        updatedAt: serverTimestamp(),
        notes: { text: value, updatedAt: serverTimestamp(), updatedBy: myUid },
        },
        { merge: true }
      );
      setSavingState('saved');
      window.setTimeout(() => setSavingState('idle'), 1200);
    }, 350);
  };

  const sinceDate = room?.togetherSince?.toDate?.() ?? null;
  const partnerPresenceText = presenceLabel(partnerPresence);
  const sortedMoments = useMemo(() => {
    const raw = (room?.moments && Object.keys(room.moments).length ? room.moments : null) ?? (room?.dates || {});
    const values = Object.values(raw || {});
    return values
      .map((d) => ({
        ...d,
        at: (d as any).at || (d as any).date || null,
      }))
      .filter((d) => d?.at)
      .sort((a, b) => {
        const am = tsToMs((a as any).at);
        const bm = tsToMs((b as any).at);
        return bm - am;
      });
  }, [room?.moments, room?.dates]);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      {/* OLED cinematic environment reacts to mood */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-black" />
        <div className={`absolute inset-0 bg-gradient-to-br ${vibeToBg(moodVibe)}`} />
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 25% 20%, rgba(255,0,229,0.12), transparent 55%), radial-gradient(circle at 70% 40%, rgba(0,240,255,0.10), transparent 60%)',
          }}
          animate={{ opacity: emergencyPulse ? [0.35, 0.9, 0.35] : [0.25, 0.45, 0.25] }}
          transition={{ duration: emergencyPulse ? 1.2 : 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
          }}
        />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {!!toast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/8 border border-white/15 backdrop-blur-2xl rounded-full px-4 py-2 text-xs text-white/70 shadow-[0_0_40px_rgba(255,0,229,0.15)]">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency received overlay pulse */}
      <AnimatePresence>
        {emergencyPulse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none"
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 30%, rgba(255,45,111,0.25), transparent 60%)',
              }}
              animate={{ opacity: [0.25, 0.75, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute top-20 left-1/2 -translate-x-1/2"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 backdrop-blur-2xl rounded-2xl px-6 py-4 border border-red-500/30 shadow-2xl">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="text-2xl"
                  >
                    ❤️
                  </motion.div>
                  <div className="text-white/90 font-medium">I NEED YOU RIGHT NOW ❤️</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating emergency heart */}
      <motion.div className="fixed bottom-32 right-6 z-50" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <motion.button
          onClick={sendEmergency}
          className="relative rounded-full p-4 border border-white/15 bg-gradient-to-r from-red-500/90 to-pink-500/90 text-white shadow-[0_0_50px_rgba(255,45,111,0.35)]"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Heart className="w-6 h-6" fill="white" />
          <motion.div
            className="absolute inset-0 rounded-full bg-white/15"
            animate={{ scale: [1, 1.55, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.button>
      </motion.div>

      <div className="relative z-10 px-6 pt-10">
        {/* Presence */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-3 bg-white/6 backdrop-blur-2xl rounded-full px-4 py-2 border border-white/10">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: partnerPresenceText === 'offline' ? '#FF00E5' : '#00F0FF',
                boxShadow: partnerPresenceText === 'offline' ? '0 0 15px rgba(255,0,229,0.35)' : '0 0 15px rgba(0,240,255,0.55)',
              }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-white/65 text-sm font-light tracking-wide">
              {displayPartner} {partnerPresenceText}
            </span>
          </div>
        </motion.div>

        {/* Timer centerpiece */}
        <div className="mb-8">
          <RelationshipTimer togetherSince={sinceDate} onSetTogetherSince={() => setShowDateModal(true)} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowDateModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/65 hover:bg-white/10 transition"
            >
              <Calendar className="w-4 h-4" />
              Add / manage dates
            </button>
          </div>
        </div>

        {/* Live Mood Sync (pills) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2 }} className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white/70 text-sm font-light tracking-[0.12em] uppercase">Live emotional sync</div>
            <div className="text-white/40 text-xs">
              {partnerMood?.emoji ? `${displayPartner}: ${partnerMood.emoji} ${partnerMood.label}` : `${displayPartner}: —`}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            {MOODS.map((m) => {
              const selected = myMood?.id === m.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => changeMood(m)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={[
                    'relative overflow-hidden rounded-full px-4 py-2 border backdrop-blur-2xl',
                    selected ? 'border-white/25 bg-white/10 text-white' : 'border-white/12 bg-white/5 text-white/70 hover:bg-white/8',
                  ].join(' ')}
                >
                  <motion.span
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
                    animate={{ x: ['-100%', '120%'] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="relative z-10 flex items-center gap-2 text-sm">
                    <motion.span
                      animate={selected ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 1.6, repeat: selected ? Infinity : 0 }}
                      className="text-lg"
                    >
                      {m.emoji}
                    </motion.span>
                    <span className="text-[13px] font-light">{m.label}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Live shared notes */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.1 }} className="mb-10">
          <div className="bg-white/4 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,240,255,0.06)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white/65">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-light tracking-wide">Shared notes</span>
              </div>
              <div className="text-[11px] text-white/40">
                {savingState === 'typing' ? 'Typing…' : savingState === 'saved' ? 'Saved just now' : partnerPresenceText === 'typing…' ? 'Seen by partner' : ''}
              </div>
            </div>

            <div className="p-5">
              <textarea
                value={localNote}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="thinking about you…"
                rows={4}
                className="w-full resize-none rounded-2xl bg-black/25 border border-white/10 px-4 py-3 text-white/85 placeholder-white/30 outline-none focus:border-white/20 focus:ring-0 caret-[#00F0FF]"
              />
            </div>
          </div>
        </motion.div>

        {/* Minimal floating actions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.2 }} className="flex justify-center gap-6 pb-8">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/canvas')}
            className="w-16 h-16 bg-white/7 backdrop-blur-2xl rounded-full border border-white/14 flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-all"
          >
            <Palette className="w-6 h-6" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/mood')}
            className="w-16 h-16 bg-white/7 backdrop-blur-2xl rounded-full border border-white/14 flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-all"
          >
            <span className="text-2xl">{myMood?.emoji ?? '❤️'}</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Moments modal (unlimited custom moments) */}
      <AnimatePresence>
        {showDateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowDateModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="absolute left-1/2 top-1/2 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-white/6 backdrop-blur-2xl p-6 shadow-[0_0_80px_rgba(255,0,229,0.12)]"
            >
              <div className="text-white/90 text-lg font-light mb-2 tracking-wide">Moments</div>
              <div className="text-white/45 text-xs mb-5">Unlimited shared memories with emoji, time, and romantic notes — synced live.</div>

              {/* Existing moments */}
              <div className="mb-5 max-h-[28vh] overflow-auto no-scrollbar space-y-2">
                {sortedMoments.length === 0 ? (
                  <div className="text-white/35 text-xs">No moments yet. Add your first memory below.</div>
                ) : (
                  sortedMoments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-lg drop-shadow-[0_0_12px_rgba(255,255,255,0.12)]">{(d as any).emoji || '✨'}</div>
                          <div className="text-white/85 text-sm font-light truncate">{(d as any).title || (d as any).label || 'A moment'}</div>
                        </div>
                        {!!(d as any).note && (
                          <div className="text-white/45 text-[11px] mt-0.5 line-clamp-2">
                            {(d as any).note}
                          </div>
                        )}
                        <div className="text-white/30 text-[11px] mt-1">
                          {(d as any).at?.toDate?.()?.toLocaleString?.() ?? ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMoment(d.id)}
                        className="shrink-0 rounded-full border border-white/12 bg-white/4 px-3 py-1.5 text-[11px] text-white/55 hover:bg-white/7 transition"
                        disabled={d.id === 'togetherSince'}
                        title={d.id === 'togetherSince' ? 'Use Together Since input below' : 'Remove'}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add new moment */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-14 shrink-0 rounded-2xl bg-black/30 border border-white/12 px-3 py-3 text-white/80 flex items-center justify-center">
                    <span className="text-xl">{momentEmojiDraft || '✨'}</span>
                  </div>
                  <input
                    type="text"
                    value={momentEmojiDraft}
                    onChange={(e) => setMomentEmojiDraft(e.target.value)}
                    placeholder="emoji"
                    maxLength={3}
                    className="flex-1 rounded-2xl bg-black/30 border border-white/12 px-4 py-3 text-white/75 outline-none focus:border-white/20"
                  />
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['💞', '🥹', '🌙', '✈️', '🌧️', '🎧', '🍿', '🌸', '🫂', '💍', '💌', '✨'].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setMomentEmojiDraft(e)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/8 transition"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={momentTitleDraft}
                  onChange={(e) => setMomentTitleDraft(e.target.value)}
                  placeholder="Title (e.g., airport goodbye)"
                  className="w-full rounded-2xl bg-black/30 border border-white/12 px-4 py-3 text-white/80 outline-none focus:border-white/20"
                />
                <textarea
                  value={momentNoteDraft}
                  onChange={(e) => setMomentNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Romantic note (e.g., “I still feel your hand in mine…”)"
                  className="w-full resize-none rounded-2xl bg-black/30 border border-white/12 px-4 py-3 text-white/70 outline-none focus:border-white/20"
                />
              <input
                  type="datetime-local"
                  value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="w-full rounded-2xl bg-black/30 border border-white/12 px-4 py-3 text-white/80 outline-none focus:border-white/20"
              />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="rounded-full border border-white/12 bg-white/4 px-4 py-2 text-xs text-white/65 hover:bg-white/7 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const raw = (dateDraft || '').trim();
                    const at = raw ? new Date(raw) : null;
                    if (at && Number.isFinite(at.getTime())) {
                      const title = (momentTitleDraft || '').trim() || 'A moment';
                      if (title.toLowerCase() === 'together since') {
                        await setTogetherSince(at);
                      } else {
                        await addMoment({
                          emoji: momentEmojiDraft,
                          title,
                          at,
                          note: momentNoteDraft,
                        });
                      }
                      setShowDateModal(false);
                      setDateDraft('');
                      setMomentEmojiDraft('✨');
                      setMomentTitleDraft('first time you said i love you');
                      setMomentNoteDraft('');
                    }
                  }}
                  className="rounded-full border border-white/12 bg-gradient-to-r from-[#FF00E5]/40 to-[#00F0FF]/30 px-4 py-2 text-xs text-white/85 hover:brightness-110 transition"
                >
                  Save date
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
