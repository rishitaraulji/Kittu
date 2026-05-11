import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Timestamp, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

type Mood = { id: string; emoji: string; label: string };
const MOODS: Mood[] = [
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'missing', emoji: '🥺', label: 'Missing You' },
  { id: 'sleepy', emoji: '😴', label: 'Sleepy' },
  { id: 'angry', emoji: '😡', label: 'Angry' },
  { id: 'jealousy', emoji: '😒', label: 'Jealousy' },
  { id: 'hug', emoji: '🤗', label: 'Need Hug' },
  { id: 'cry', emoji: '😭', label: 'Crying' },
  { id: 'obsessed', emoji: '😍', label: 'Obsessed' },
  { id: 'kiss', emoji: '😚', label: 'Kiss' },
  { id: 'overthinking', emoji: '😵', label: 'Overthinking' },
];

type Room = {
  participants?: string[];
  moods?: Record<string, { id: string; emoji: string; label: string; changedAt?: Timestamp | null | any }>;
  lastMoodEvent?: { text: string; at?: Timestamp | null | any };
  updatedAt?: Timestamp | null | any;
  createdAt?: Timestamp | null | any;
};

function relationshipIdFor(a: string, b: string) {
  return [a, b].sort().join('_');
}

const MoodTracker = () => {
  const { currentUser, userProfile, partnerName } = useAuth();
  const partnerId = userProfile?.partnerId || null;
  const myUid = currentUser?.uid || null;
  const relationshipId = useMemo(() => {
    if (!myUid || !partnerId) return null;
    return relationshipIdFor(myUid, partnerId);
  }, [myUid, partnerId]);

  const roomRef = useMemo(() => {
    if (!relationshipId) return null;
    return doc(db, 'relationships', relationshipId);
  }, [relationshipId]);

  const [room, setRoom] = useState<Room | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastMoodTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomRef || !myUid || !partnerId) return;
    const unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(
          roomRef,
          { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), participants: [myUid, partnerId] },
          { merge: true }
        );
        return;
      }
      const data = snap.data() as Room;
      setRoom(data);
      if (data.lastMoodEvent?.text && data.lastMoodEvent.text !== lastMoodTextRef.current) {
        lastMoodTextRef.current = data.lastMoodEvent.text;
        setToast(data.lastMoodEvent.text);
        window.setTimeout(() => setToast(null), 2400);
      }
    });
    return () => unsub();
  }, [roomRef, myUid, partnerId]);

  const displayPartner = partnerName || 'your partner';
  const myMood = myUid ? room?.moods?.[myUid] : undefined;
  const partnerMood = partnerId ? room?.moods?.[partnerId] : undefined;

  const selectMood = async (m: Mood) => {
    if (!roomRef || !myUid) return;
    await setDoc(
      roomRef,
      {
      updatedAt: serverTimestamp(),
      [`moods.${myUid}`]: { id: m.id, emoji: m.emoji, label: m.label, changedAt: serverTimestamp() },
      lastMoodEvent: { text: `Krisha changed mood to ${m.emoji} ${m.label}`, at: serverTimestamp() },
      },
      { merge: true }
    );
  };

  return (
    <div className="min-h-full bg-bg-primary pb-24">
      <div className="sticky top-0 z-10 p-5 pt-6 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-accent-primary/10">
        <h2 className="text-xl font-bold text-white mb-1">Live Emotional Sync</h2>
        <p className="text-[13px] text-text-muted">Instant mood syncing with {displayPartner}</p>
      </div>

      <div className="p-5">
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card mb-6 py-10 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,240,255,0.12),transparent_55%)]" />

          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-7xl mb-4 relative z-10 drop-shadow-2xl flex gap-4"
          >
            <span>{myMood?.emoji ?? '—'}</span>
            <span className="opacity-60">{partnerMood?.emoji ?? '—'}</span>
          </motion.div>

          <h3 className="text-xl font-bold text-white mb-1 relative z-10">
            {myMood?.label ?? 'Choose your mood'}
          </h3>
          <p className="text-[13px] text-text-soft text-center px-4 relative z-10">
            {partnerMood?.emoji
              ? `${displayPartner} is ${partnerMood.emoji} ${partnerMood.label}`
              : `${displayPartner} hasn’t picked a mood yet.`}
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 justify-center">
          {MOODS.map((m) => {
            const selected = myMood?.id === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                onClick={() => selectMood(m)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className={[
                  'rounded-full px-4 py-2 border backdrop-blur-xl transition',
                  selected ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{m.emoji}</span>
                  <span className="text-[13px] font-light">{m.label}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {!!toast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/8 border border-white/15 backdrop-blur-2xl rounded-full px-4 py-2 text-xs text-white/70">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoodTracker;
