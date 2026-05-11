import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import {
  relationshipDocRef,
  relationshipIdFor,
  relationshipMoodsRef,
  type RelationshipMood,
} from '../../services/relationshipRealtime';
import { db } from '../../firebase/config';

type Mood = { id: string; emoji: string; label: string };

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

const MoodTracker = () => {
  const { currentUser, userProfile, partnerName } = useAuth();
  const partnerId = userProfile?.partnerId || null;
  const myUid = currentUser?.uid || null;
  const relationshipId = useMemo(() => {
    if (!myUid || !partnerId) return null;
    return relationshipIdFor(myUid, partnerId);
  }, [myUid, partnerId]);

  const moodsColRef = useMemo(() => (relationshipId ? relationshipMoodsRef(relationshipId) : null), [relationshipId]);
  const roomRef = useMemo(() => (relationshipId ? relationshipDocRef(relationshipId) : null), [relationshipId]);

  const [moodMap, setMoodMap] = useState<Record<string, RelationshipMood>>({});
  const [toast, setToast] = useState<string | null>(null);
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!moodsColRef || !myUid || !partnerId) return;

    const unsub = onSnapshot(moodsColRef, (snap) => {
      const next: Record<string, RelationshipMood> = {};
      snap.docs.forEach((d) => {
        next[d.id] = d.data() as RelationshipMood;
      });
      setMoodMap(next);
    });

    return () => unsub();
  }, [moodsColRef, myUid, partnerId]);

  const displayPartner = partnerName || 'your partner';
  const myMood = myUid ? moodMap[myUid] : undefined;
  const partnerMood = partnerId ? moodMap[partnerId] : undefined;

  useEffect(() => {
    if (!partnerMood) return;
    const text = `Your partner feels ${partnerMood.id === 'jealous' ? 'jealous' : partnerMood.label.toLowerCase()} ${partnerMood.emoji}`;
    if (text !== lastToastRef.current) {
      lastToastRef.current = text;
      setToast(text);
      const timer = window.setTimeout(() => setToast(null), 2600);
      return () => window.clearTimeout(timer);
    }
  }, [partnerMood]);

  const selectMood = async (m: Mood) => {
    if (!relationshipId || !myUid || !moodsColRef || !roomRef) return;
    await Promise.all([
      setDoc(
        doc(db, 'relationships', relationshipId, 'moods', myUid),
        { userId: myUid, id: m.id, emoji: m.emoji, label: m.label, updatedAt: Date.now() },
        { merge: true }
      ),
      setDoc(
        roomRef,
        {
          updatedAt: serverTimestamp(),
          [`presence.${myUid}.lastActiveAt`]: serverTimestamp(),
          [`presence.${myUid}.activity`]: 'active',
        },
        { merge: true }
      ),
    ]);
  };

  const selectedAmbient = myMood?.id === 'jealous' || partnerMood?.id === 'jealous' ? 'from-cyan-950/40 via-emerald-950/20 to-black' : 'from-fuchsia-950/20 via-slate-950/20 to-black';

  return (
    <div className="relative min-h-full overflow-hidden pb-24">
      <div className={`absolute inset-0 bg-gradient-to-br ${selectedAmbient}`} />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: myMood?.id === 'jealous' ? 1.8 : 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            myMood?.id === 'jealous'
              ? 'radial-gradient(circle at 50% 30%, rgba(34,197,94,0.18), transparent 55%), radial-gradient(circle at 20% 80%, rgba(34,211,238,0.14), transparent 45%)'
              : 'radial-gradient(circle at 50% 30%, rgba(255,0,229,0.12), transparent 55%), radial-gradient(circle at 20% 80%, rgba(0,240,255,0.10), transparent 45%)',
        }}
      />

      <div className="sticky top-0 z-10 p-5 pt-6 bg-black/70 backdrop-blur-2xl border-b border-white/8">
        <h2 className="text-xl font-semibold text-white mb-1 tracking-wide">Live Emotional Sync</h2>
        <p className="text-[13px] text-white/55">Instant mood syncing with {displayPartner}</p>
      </div>

      <div className="p-5">
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card mb-6 py-10 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: myMood?.id === 'jealous' ? [0.35, 0.75, 0.35] : [0.2, 0.45, 0.2] }}
            transition={{ duration: myMood?.id === 'jealous' ? 1.9 : 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                myMood?.id === 'jealous'
                  ? 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 58%)'
                  : 'radial-gradient(circle, rgba(255,0,229,0.12), transparent 58%)',
            }}
          />

          <motion.div
            animate={myMood?.id === 'jealous' ? { scale: [1, 1.04, 1], y: [-6, 6, -6] } : { y: [-8, 8, -8] }}
            transition={{ duration: myMood?.id === 'jealous' ? 1.3 : 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-7xl mb-4 relative z-10 drop-shadow-2xl flex gap-4"
          >
            <span>{myMood?.emoji ?? '—'}</span>
            <span className="opacity-60">{partnerMood?.emoji ?? '—'}</span>
          </motion.div>

          <h3 className="text-xl font-semibold text-white mb-1 relative z-10">
            {myMood?.label ?? 'Choose your mood'}
          </h3>
          <p className="text-[13px] text-white/60 text-center px-4 relative z-10">
            {partnerMood
              ? partnerMood.id === 'jealous'
                ? `${displayPartner} feels jealous 😒💚`
                : `${displayPartner} is ${partnerMood.emoji} ${partnerMood.label}`
              : `${displayPartner} hasn’t picked a mood yet.`}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  'relative overflow-hidden rounded-3xl px-4 py-4 border backdrop-blur-2xl transition text-left',
                  selected
                    ? 'border-white/25 bg-white/12 text-white shadow-[0_0_30px_rgba(255,255,255,0.08)]'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8',
                  m.id === 'jealous' ? 'ring-1 ring-emerald-400/20' : '',
                ].join(' ')}
              >
                <motion.span
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
                  animate={{ x: ['-120%', '120%'] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }}
                />
                <div className="relative z-10 flex flex-col gap-2">
                  <motion.span
                    animate={selected ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 1.4, repeat: selected ? Infinity : 0 }}
                    className="text-2xl"
                  >
                    {m.emoji}
                  </motion.span>
                  <span className="text-[13px] font-light tracking-wide">{m.label}</span>
                </div>
                {selected && (
                  <motion.div
                    className="absolute inset-0 rounded-3xl"
                    animate={{ opacity: [0.2, 0.45, 0.2] }}
                    transition={{ duration: m.id === 'jealous' ? 1.2 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      boxShadow:
                        m.id === 'jealous'
                          ? '0 0 0 1px rgba(34,197,94,0.35), 0 0 30px rgba(34,211,238,0.15)'
                          : '0 0 0 1px rgba(255,255,255,0.2), 0 0 24px rgba(255,0,229,0.12)',
                    }}
                  />
                )}
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
            <div className="bg-black/60 border border-white/15 backdrop-blur-2xl rounded-full px-4 py-2 text-xs text-white/75 shadow-[0_0_40px_rgba(34,197,94,0.14)]">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoodTracker;
