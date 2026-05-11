import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Eraser, Palette, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import {
  relationshipCanvasStrokesRef,
  relationshipCanvasStrokesQuery,
  relationshipDocRef,
  relationshipIdFor,
  type RelationshipCanvasStroke,
} from '../../services/relationshipRealtime';

type CanvasReaction = {
  id: string;
  message: string;
  userId: string;
  timestamp: number;
};

type LiveRoom = {
  presence?: Record<string, { activity?: string; lastActiveAt?: unknown }>;
  participants?: string[];
};

const COLORS = ['#FF00E5', '#00F0FF', '#22C55E', '#FDE047', '#FFFFFF'];
const REACTIONS = ['aww ❤️', 'miss you 🥺', 'idiot 😭'];

const createId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const LiveCanvas = () => {
  const { currentUser, userProfile, partnerName } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const activeStrokeIdRef = useRef<string | null>(null);
  const lastPointByStrokeRef = useRef(new Map<string, RelationshipCanvasStroke>());
  const historyRef = useRef<RelationshipCanvasStroke[]>([]);
  const processedIdsRef = useRef(new Set<string>());
  const reactionTimerRef = useRef<number | null>(null);

  const [color, setColor] = useState('#FF00E5');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [reactions, setReactions] = useState<CanvasReaction[]>([]);

  const partnerId = userProfile?.partnerId || null;
  const myUid = currentUser?.uid || null;
  const relationshipId = useMemo(() => {
    if (!myUid || !partnerId) return null;
    return relationshipIdFor(myUid, partnerId);
  }, [myUid, partnerId]);

  const roomRef = useMemo(() => (relationshipId ? relationshipDocRef(relationshipId) : null), [relationshipId]);
  const strokesRef = useMemo(() => (relationshipId ? relationshipCanvasStrokesRef(relationshipId) : null), [relationshipId]);
  const strokeQuery = useMemo(() => (relationshipId ? relationshipCanvasStrokesQuery(relationshipId) : null), [relationshipId]);
  const partnerDrawing = !!(partnerId && room?.presence?.[partnerId]?.activity === 'drawing');
  const displayPartner = partnerName || 'Partner';

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(parent.clientWidth * ratio);
    canvas.height = Math.floor(parent.clientHeight * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    replayHistory();
  };

  const clearSurface = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const drawStrokePoint = (point: RelationshipCanvasStroke, previous?: RelationshipCanvasStroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || point.x == null || point.y == null) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = point.isEraser ? 'destination-out' : 'source-over';

    if (point.isEraser) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.strokeStyle = point.color || color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = point.color || color;
    }

    if (previous && previous.x != null && previous.y != null && previous.strokeId === point.strokeId) {
      ctx.lineWidth = point.size || brushSize;
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      const midX = (previous.x + point.x) / 2;
      const midY = (previous.y + point.y) / 2;
      ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
      ctx.quadraticCurveTo(midX, midY, point.x, point.y);
      ctx.stroke();

      if (!point.isEraser) {
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = (point.size || brushSize) * 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }

    ctx.fillStyle = point.isEraser ? 'rgba(0,0,0,1)' : (point.color || color);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.5, (point.size || brushSize) / 2), 0, Math.PI * 2);
    ctx.fill();
  };

  const replayHistory = () => {
    clearSurface();
    lastPointByStrokeRef.current = new Map();

    for (const item of historyRef.current) {
      if (item.action === 'clear') {
        clearSurface();
        lastPointByStrokeRef.current = new Map();
        continue;
      }
      if (item.action !== 'point') continue;

      const previous = item.strokeId ? lastPointByStrokeRef.current.get(item.strokeId) : undefined;
      drawStrokePoint(item, previous);
      if (item.strokeId) {
        lastPointByStrokeRef.current.set(item.strokeId, item);
      }
    }
  };

  useEffect(() => {
    if (!relationshipId || !roomRef || !strokesRef || !strokeQuery || !myUid || !partnerId) return;

    const initCanvas = () => {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    };

    initCanvas();

    const unsubRoom = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(
          roomRef,
          {
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            participants: [myUid, partnerId],
          },
          { merge: true }
        );
        return;
      }
      setRoom(snap.data() as LiveRoom);
    });

    const unsubStrokes = onSnapshot(strokeQuery, (snap) => {
      const added = snap.docChanges().filter((change) => change.type === 'added');
      if (!added.length && historyRef.current.length === 0) {
        return;
      }

      let needsReplay = false;

      for (const change of added) {
        if (processedIdsRef.current.has(change.doc.id)) continue;
        processedIdsRef.current.add(change.doc.id);

        const data = { id: change.doc.id, ...(change.doc.data() as RelationshipCanvasStroke) };
        historyRef.current.push(data);

        if (data.action === 'clear') {
          clearSurface();
          lastPointByStrokeRef.current = new Map();
          needsReplay = false;
          continue;
        }

        if (data.action !== 'point') continue;
        const previous = data.strokeId ? lastPointByStrokeRef.current.get(data.strokeId) : undefined;
        drawStrokePoint(data, previous);
        if (data.strokeId) {
          lastPointByStrokeRef.current.set(data.strokeId, data);
        }
      }

      if (needsReplay) {
        replayHistory();
      }
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      unsubRoom();
      unsubStrokes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId, roomRef, strokesRef, strokeQuery, myUid, partnerId]);

  const updatePresence = async (activity: 'active' | 'drawing') => {
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

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const addStrokePoint = async (point: { x: number; y: number }, strokeId: string) => {
    if (!strokesRef || !myUid) return;
    const docId = createId();
    const payload: RelationshipCanvasStroke = {
      action: 'point',
      strokeId,
      x: point.x,
      y: point.y,
      color,
      size: brushSize,
      timestamp: Date.now(),
      userId: myUid,
      isEraser,
    };

    processedIdsRef.current.add(docId);
    const previous = lastPointByStrokeRef.current.get(strokeId);
    drawStrokePoint(payload, previous);
    lastPointByStrokeRef.current.set(strokeId, payload);
    historyRef.current.push({ id: docId, ...payload });

    await setDoc(doc(strokesRef, docId), payload);
  };

  const startDrawing = async (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!myUid) return;
    isDrawingRef.current = true;
    activeStrokeIdRef.current = createId();
    event.currentTarget.setPointerCapture(event.pointerId);
    await updatePresence('drawing');

    const point = getCanvasPoint(event);
    if (point) {
      await addStrokePoint(point, activeStrokeIdRef.current);
    }
  };

  const continueDrawing = async (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeIdRef.current) return;
    const point = getCanvasPoint(event);
    if (point) {
      await addStrokePoint(point, activeStrokeIdRef.current);
    }
  };

  const stopDrawing = async () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    activeStrokeIdRef.current = null;
    await updatePresence('active');
  };

  const clearCanvas = async () => {
    if (!strokesRef || !myUid) return;
    const docId = createId();
    const payload: RelationshipCanvasStroke = {
      action: 'clear',
      timestamp: Date.now(),
      userId: myUid,
    };
    processedIdsRef.current.add(docId);
    historyRef.current.push({ id: docId, ...payload });
    clearSurface();
    lastPointByStrokeRef.current = new Map();
    await setDoc(doc(strokesRef, docId), payload);
  };

  const sendReaction = async (message: string) => {
    if (!roomRef || !myUid) return;
    const reaction: CanvasReaction = {
      id: createId(),
      message,
      userId: myUid,
      timestamp: Date.now(),
    };

    setReactions((prev) => [...prev, reaction]);
    if (reactionTimerRef.current) {
      window.clearTimeout(reactionTimerRef.current);
    }
    reactionTimerRef.current = window.setTimeout(() => {
      setReactions((prev) => prev.filter((item) => item.id !== reaction.id));
    }, 2800);

    await setDoc(doc(db, 'relationships', relationshipId as string, 'canvas', 'shared'), { lastReaction: reaction }, { merge: true });
  };

  useEffect(() => {
    if (!relationshipId) return;
    const unsub = onSnapshot(doc(db, 'relationships', relationshipId, 'canvas', 'shared'), (snap) => {
      const data = snap.data() as { lastReaction?: CanvasReaction } | undefined;
      if (!data?.lastReaction) return;
      const sharedReaction = data.lastReaction;
      if (sharedReaction.userId === myUid) return;
      setReactions((prev) => [...prev, sharedReaction]);
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((item) => item.id !== sharedReaction.id));
      }, 2800);
    });

    return () => unsub();
  }, [relationshipId, myUid]);

  const pushReactionToPartner = async (message: string) => {
    if (!relationshipId || !myUid) return;
    const reaction: CanvasReaction = {
      id: createId(),
      message,
      userId: myUid,
      timestamp: Date.now(),
    };
    setReactions((prev) => [...prev, reaction]);
    await setDoc(
      doc(db, 'relationships', relationshipId, 'canvas', 'meta'),
      {
        lastReaction: reaction,
      },
      { merge: true }
    );
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((item) => item.id !== reaction.id));
    }, 2800);
  };

  const partnerIndicator = partnerDrawing ? `${displayPartner} is drawing...` : `Connected to ${displayPartner}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,240,255,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,0,229,0.14),transparent_42%),linear-gradient(180deg,#050508_0%,#000_100%)]" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

      <div className="relative z-10 flex items-center justify-between gap-4 px-5 pt-8 pb-4 bg-gradient-to-b from-black/85 to-transparent backdrop-blur-2xl border-b border-white/8">
        <button
          onClick={() => navigate(-1)}
          className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85 shadow-[0_0_30px_rgba(255,255,255,0.06)] transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-4 py-2 text-xs tracking-[0.24em] text-cyan-100"
            animate={{ opacity: partnerDrawing ? [1, 0.6, 1] : 1 }}
            transition={{ duration: 1, repeat: partnerDrawing ? Infinity : 0 }}
          >
            <motion.span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(0,240,255,0.9)]" animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
            Live Canvas
          </motion.div>
          <div className="mt-2 text-[12px] uppercase tracking-[0.26em] text-white/55">{partnerIndicator}</div>
        </div>
        <div className="w-12" />
      </div>

      <div className="relative z-10 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          key={canvasKey}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 text-center opacity-20">
          <p className="max-w-xs text-4xl font-thin leading-tight text-white/35 drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
            Draw something intimate together...
          </p>
        </div>

        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-white/85 backdrop-blur-2xl shadow-[0_0_30px_rgba(255,255,255,0.08)]"
            >
              {reaction.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-black/85 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            <Palette className="h-4 w-4 text-cyan-300" />
            Neon brush
          </div>
          <button
            onClick={() => setShowPalette((value) => !value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/75 transition active:scale-95"
          >
            {showPalette ? 'Hide tools' : 'Show tools'}
          </button>
        </div>

        <AnimatePresence>
          {showPalette && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mb-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl"
            >
              <div className="flex flex-wrap items-center gap-3">
                {COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    className={`h-8 w-8 rounded-full border transition ${color === swatch ? 'scale-110 border-white shadow-[0_0_18px_rgba(255,255,255,0.45)]' : 'border-white/15'}`}
                    style={{ backgroundColor: swatch, boxShadow: color === swatch ? `0 0 18px ${swatch}` : 'none' }}
                  />
                ))}

                <label className="ml-auto flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-white/70">
                  Size
                  <input type="range" min="1" max="18" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="accent-cyan-300" />
                </label>

                <button
                  type="button"
                  onClick={() => setIsEraser((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition ${isEraser ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/5 text-white/70'}`}
                >
                  <Eraser className="h-4 w-4" />
                  Eraser
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 transition active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            Clear canvas
          </button>

          <div className="flex gap-2 overflow-x-auto">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => pushReactionToPartner(reaction)}
                className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition active:scale-95"
              >
                {reaction}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/45">
          <Heart className="h-3.5 w-3.5 fill-white/70 text-white/70" />
          Firestore live sync
        </div>
      </div>
    </div>
  );
};

export default LiveCanvas;
