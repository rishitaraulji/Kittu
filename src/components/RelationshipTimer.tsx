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
      className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-black/35 p-5 shadow-[0_0_60px_rgba(255,0,229,0.12)] backdrop-blur-2xl"
    >
      <motion.div
        className="absolute -inset-10 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(0,240,255,0.16), transparent 55%), radial-gradient(circle at 80% 40%, rgba(255,0,229,0.16), transparent 60%)',
          filter: 'blur(18px)',
        }}
        animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.34em] text-white/50 font-mono">Together Since</p>
            <h3 className="mt-2 text-lg font-light tracking-wide text-white/90">Real relationship timer</h3>
          </div>
          {since && (
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/55">
              {totalDays} days
            </div>
          )}
        </div>

        {!diff ? (
          <div className="flex flex-col items-start gap-3">
            <div className="text-5xl font-thin text-white/90 tracking-tight drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]">—</div>
            <button
              type="button"
              onClick={onSetTogetherSince}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/75 transition hover:bg-white/10"
            >
              Set together since
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Years', value: diff.years },
              { label: 'Months', value: diff.months },
              { label: 'Days', value: diff.days },
              { label: 'Hours', value: diff.hours },
              { label: 'Minutes', value: diff.minutes },
              { label: 'Seconds', value: diff.seconds },
            ].map((unit, index) => (
              <motion.div
                key={unit.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 text-center"
              >
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">{unit.label}</div>
                <div className="mt-2 text-4xl font-thin tabular-nums text-white drop-shadow-[0_0_26px_rgba(255,255,255,0.18)]">
                  {pad2(unit.value)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RelationshipTimer;
