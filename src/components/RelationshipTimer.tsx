import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

type TogetherSinceInput = Date | number | null | undefined;

interface RelationshipTimerProps {
  togetherSince: TogetherSinceInput;
  onSetTogetherSince?: () => void;
}

function toDate(value: TogetherSinceInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function addMonths(d: Date, months: number) {
  const copy = new Date(d);
  const targetMonth = copy.getMonth() + months;
  // Set to 1st to avoid month-length rollover, then clamp day.
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(targetMonth);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

function calendarDiff(from: Date, to: Date) {
  const start = new Date(from);
  const end = new Date(to);
  if (end.getTime() < start.getTime()) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  // Years
  let years = end.getFullYear() - start.getFullYear();
  const yAnniversary = new Date(start);
  yAnniversary.setFullYear(start.getFullYear() + years);
  if (yAnniversary.getTime() > end.getTime()) years -= 1;

  // Months
  const afterYears = new Date(start);
  afterYears.setFullYear(start.getFullYear() + years);
  let months =
    end.getMonth() -
    afterYears.getMonth() +
    (end.getFullYear() - afterYears.getFullYear()) * 12;
  const mAnniversary = addMonths(afterYears, months);
  if (mAnniversary.getTime() > end.getTime()) months -= 1;

  const anchor = addMonths(afterYears, months);
  const remainderMs = end.getTime() - anchor.getTime();

  const days = Math.floor(remainderMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainderMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remainderMs / (1000 * 60)) % 60);
  const seconds = Math.floor((remainderMs / 1000) % 60);

  return { years, months, days, hours, minutes, seconds };
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

const RelationshipTimer: React.FC<RelationshipTimerProps> = ({ togetherSince, onSetTogetherSince }) => {
  const since = useMemo(() => toDate(togetherSince), [togetherSince]);
  const [now, setNow] = useState(() => new Date());
  const totalDays = useMemo(() => {
    if (!since) return 0;
    const ms = Math.max(0, now.getTime() - since.getTime());
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }, [since, now]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = useMemo(() => {
    if (!since) return null;
    return calendarDiff(since, now);
  }, [since, now]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0B001A]/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 mb-6 shadow-[0_0_60px_rgba(255,0,229,0.10)] relative overflow-hidden"
    >
      <motion.div
        className="absolute -inset-10 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(0,240,255,0.18), transparent 55%), radial-gradient(circle at 80% 40%, rgba(255,0,229,0.16), transparent 60%)',
          filter: 'blur(18px)',
        }}
        animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/50 mb-3 font-mono">
          Together Since
        </p>

        {!diff ? (
          <div className="space-y-3">
            <div className="text-white/90 text-4xl font-thin tracking-tight drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]">
              —
            </div>
            <button
              type="button"
              onClick={onSetTogetherSince}
              className="mx-auto inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition"
            >
              Set date
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-center gap-4">
              <div className="text-7xl font-thin text-white tabular-nums tracking-tight drop-shadow-[0_0_40px_rgba(255,255,255,0.25)]">
                {totalDays}
              </div>
              <div className="pb-2 text-[11px] text-white/40 tracking-[0.28em] uppercase">
                Days
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-white/60 text-[11px] tracking-wide">
              <span className="tabular-nums">{diff.years}</span>
              <span className="opacity-50">Y</span>
              <span className="tabular-nums">{diff.months}</span>
              <span className="opacity-50">M</span>
              <span className="tabular-nums">{diff.days}</span>
              <span className="opacity-50">D</span>
            </div>

            <div className="font-mono text-4xl text-white tabular-nums tracking-[0.12em] drop-shadow-[0_0_28px_rgba(255,0,229,0.35)]">
              {pad2(diff.hours)}:{pad2(diff.minutes)}:
              <motion.span
                key={diff.seconds}
                initial={{ opacity: 0.4, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block"
              >
                {pad2(diff.seconds)}
              </motion.span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RelationshipTimer;
