import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { Heart, Trash2, X, Circle, Eraser, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { socketService, DrawingPoint, HeartReaction } from '../../services/socketService';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const LiveCanvas = () => {
  const { partnerName, userId, userProfile } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#FF00E5');
  const [brushSize, setBrushSize] = useState(4);
  const [partnerDrawing, setPartnerDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrushSlider, setShowBrushSlider] = useState(false);
  const [heartReactions, setHeartReactions] = useState<HeartReaction[]>([]);
  const [particles, setParticles] = useState<Array<{id: string, x: number, y: number, vx: number, vy: number}>>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const lastPointRef = useRef<DrawingPoint | null>(null);

  const colors = ['#FF00E5', '#00F0FF', '#FFB800', '#00FF66', '#FFFFFF'];
  const partnerId = userProfile?.partnerId || null;
  const relationshipId = userId && partnerId ? [userId, partnerId].sort().join('_') : null;
  const roomRef = relationshipId ? doc(db, 'relationships', relationshipId) : null;
  const eventsRef = relationshipId ? collection(db, 'relationships', relationshipId, 'canvasEvents') : null;
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // When relationship changes (or user signs in/out), reset event de-dupe.
    seenEventIdsRef.current = new Set();
    lastPointRef.current = null;
    setPartnerDrawing(false);
  }, [relationshipId, userId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize canvas to match container
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          tempCtx.drawImage(canvas, 0, 0);
        }
        
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx && tempCtx) {
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Firestore realtime sync (no server required)
    let unsubEvents: (() => void) | null = null;
    if (eventsRef && userId) {
      // Important: replay events oldest -> newest, otherwise strokes can render out-of-order.
      const qy = query(eventsRef, orderBy('createdAt', 'asc'), limit(300));
      unsubEvents = onSnapshot(qy, (snap) => {
        const changes = snap.docChanges();
        for (const ch of changes) {
          if (ch.type !== 'added') continue;
          if (seenEventIdsRef.current.has(ch.doc.id)) continue;
          seenEventIdsRef.current.add(ch.doc.id);
          const data = ch.doc.data() as any;
          if (data.from === userId) continue;

          if (data.type === 'strokeStart') {
            lastPointRef.current = data.point as DrawingPoint;
            setPartnerDrawing(true);
          } else if (data.type === 'drawPoint') {
            drawPoint(data.point as DrawingPoint, false);
          } else if (data.type === 'strokeEnd') {
            lastPointRef.current = null;
            setPartnerDrawing(false);
          } else if (data.type === 'clear') {
            clearCanvas(false);
          } else if (data.type === 'heart') {
            const reaction: HeartReaction = {
              x: data.x,
              y: data.y,
              userId: data.from,
              timestamp: Date.now(),
            };
            setHeartReactions((prev) => [...prev, reaction]);
            setTimeout(() => {
              setHeartReactions((prev) => prev.filter((r) => r !== reaction));
            }, 3000);
          }
        }
      });
    }
    
    // Initialize ambient particles
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: `particle-${i}`,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5
    }));
    setParticles(newParticles);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      socketService.disconnect();
      unsubEvents?.();
    };
  }, [userId, relationshipId, eventsRef]);

  const drawSmoothLine = (from: DrawingPoint, to: DrawingPoint, isLocal: boolean = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = to.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (to.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = to.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = to.color;
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    
    // Calculate control points for smooth bezier curve
    const cpx = (from.x + to.x) / 2;
    const cpy = (from.y + to.y) / 2;
    
    ctx.quadraticCurveTo(from.x, from.y, cpx, cpy);
    ctx.quadraticCurveTo(cpx, cpy, to.x, to.y);
    
    ctx.stroke();
    
    // Add glow effect for non-eraser
    if (!to.isEraser) {
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = to.size * 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  
  const drawPoint = (point: DrawingPoint, emit: boolean = true) => {
    if (lastPointRef.current) {
      drawSmoothLine(lastPointRef.current, point);
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = point.isEraser ? 'rgba(0,0,0,1)' : point.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    lastPointRef.current = point;
    
    if (emit && eventsRef && userId) {
      addDoc(eventsRef, {
        type: 'drawPoint',
        from: userId,
        point,
        createdAt: serverTimestamp(),
      });
    } else if (emit) {
      socketService.emitDraw(point);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const point = getCoordinates(e);
    if (point) {
      const drawPointData: DrawingPoint = {
        ...point,
        color,
        size: brushSize,
        isEraser
      };
      lastPointRef.current = drawPointData;
      if (eventsRef && userId) {
        addDoc(eventsRef, { type: 'strokeStart', from: userId, point: drawPointData, createdAt: serverTimestamp() });
        addDoc(eventsRef, { type: 'drawPoint', from: userId, point: drawPointData, createdAt: serverTimestamp() });
      } else {
        socketService.emitStrokeStart(drawPointData);
        socketService.emitDraw(drawPointData);
      }
    }

    if (roomRef && userId) {
      setDoc(
        roomRef,
        {
        updatedAt: serverTimestamp(),
        [`presence.${userId}.activity`]: 'drawing',
        [`presence.${userId}.lastActiveAt`]: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      if (eventsRef && userId) {
        addDoc(eventsRef, { type: 'strokeEnd', from: userId, createdAt: serverTimestamp() });
      } else {
        socketService.emitStrokeEnd();
      }
    }

    if (roomRef && userId) {
      setDoc(
        roomRef,
        {
        updatedAt: serverTimestamp(),
        [`presence.${userId}.activity`]: 'active',
        [`presence.${userId}.lastActiveAt`]: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };
  
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): {x: number, y: number} | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const point = getCoordinates(e);
    if (point) {
      const pointData: DrawingPoint = {
        ...point,
        color,
        size: brushSize,
        isEraser
      };
      drawPoint(pointData);
    }
  };

  const clearCanvas = (emit: boolean = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    if (emit) {
      if (eventsRef && userId) {
        addDoc(eventsRef, { type: 'clear', from: userId, createdAt: serverTimestamp() });
      } else {
        socketService.emitClearCanvas();
      }
    }
  };
  
  const sendHeartReaction = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    
    if (eventsRef && userId) {
      addDoc(eventsRef, { type: 'heart', from: userId, x, y, createdAt: serverTimestamp() });
    } else {
      socketService.emitHeartReaction(x, y);
    }
    
    // Add local heart reaction
    const reaction: HeartReaction = {
      x,
      y,
      userId: userId || 'local',
      timestamp: Date.now()
    };
    setHeartReactions(prev => [...prev, reaction]);
    setTimeout(() => {
      setHeartReactions(prev => prev.filter(r => r !== reaction));
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-[#0B001A] z-[100] flex flex-col overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,240,255,0.1)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(255,0,229,0.1)_0%,transparent_50%)] pointer-events-none"></div>
      
      {/* Film Grain Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between p-5 pt-8 bg-gradient-to-b from-[#0B001A]/90 to-transparent backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 active:scale-95 transition-all hover:bg-white/15 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-3 h-3 rounded-full bg-[#00F0FF] shadow-[0_0_12px_#00F0FF]"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-white font-semibold tracking-wide text-sm drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">Live Connection</span>
          </div>
          <motion.span 
            className="text-[#00F0FF]/80 text-[11px] uppercase tracking-widest mt-1 drop-shadow-[0_0_5px_rgba(0,240,255,0.2)]"
            animate={{ opacity: partnerDrawing ? [1, 0.5, 1] : 1 }}
            transition={{ duration: 1, repeat: partnerDrawing ? Infinity : 0 }}
          >
            {partnerDrawing ? `${partnerName || 'Partner'} is drawing...` : `Connected to ${partnerName || 'Partner'}`}
          </motion.span>
        </div>
        <div className="w-12 h-12"></div> {/* Spacer for center alignment */}
      </div>

      {/* Drawing Canvas */}
      <div className="flex-1 relative w-full h-full cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="absolute inset-0 z-10"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <p className="text-white/30 font-dancing text-4xl text-center px-10 leading-relaxed blur-[1px]">
            Draw something beautiful together...
          </p>
        </div>
      </div>

      {/* Brush Size Slider */}
      <AnimatePresence>
        {showBrushSlider && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-24 left-5 right-5 bg-white/15 backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm font-medium">Size:</span>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="flex-1 accent-[#FF00E5] h-2 rounded-full"
              />
              <motion.div 
                className="rounded-full bg-gradient-to-br from-white to-[#00F0FF] shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                style={{ width: `${Math.min(brushSize + 10, 30)}px`, height: `${Math.min(brushSize + 10, 30)}px` }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heart Reactions */}
      <AnimatePresence>
        {heartReactions.map((reaction) => (
          <motion.div
            key={`${reaction.timestamp}-${reaction.x}-${reaction.y}`}
            initial={{ opacity: 0, scale: 0, y: reaction.y }}
            animate={{ opacity: 1, scale: 1, y: reaction.y - 50 }}
            exit={{ opacity: 0, scale: 1.5, y: reaction.y - 100 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute pointer-events-none z-20"
            style={{ left: reaction.x, top: reaction.y }}
          >
            <Heart className="w-8 h-8 text-[#FF00E5] fill-[#FF00E5] drop-shadow-[0_0_20px_#FF00E5]" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Ambient Particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full bg-[#00F0FF] opacity-30 pointer-events-none"
          style={{ left: particle.x, top: particle.y }}
          animate={{
            x: [0, 20, -20, 0],
            y: [0, -20, 20, 0],
          }}
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Bottom Toolbar */}
      <div className="relative z-10 p-5 bg-[#0B001A]/90 backdrop-blur-xl border-t border-white/20 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2.5 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            {colors.map(c => (
              <motion.button
                key={c}
                onClick={() => setColor(c)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`w-7 h-7 rounded-full transition-all ${color === c ? 'scale-125 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'hover:scale-110'}`}
                style={{ 
                  backgroundColor: c, 
                  boxShadow: color === c ? `0 0 20px ${c}, inset 0 0 10px rgba(255,255,255,0.3)` : `0 4px 15px ${c}40`
                }}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <motion.button 
              onClick={() => clearCanvas()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white/70 hover:text-white hover:bg-white/15 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
            <motion.button 
              onClick={() => setShowBrushSlider(!showBrushSlider)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white/70 hover:text-white hover:bg-white/15 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all relative"
            >
              <Sliders className="w-5 h-5" />
              <motion.div 
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.button>
            <motion.button 
              onClick={() => setIsEraser(!isEraser)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 backdrop-blur-md rounded-2xl active:scale-95 transition-all border ${
                isEraser 
                  ? 'bg-gradient-to-tr from-[#00F0FF] to-[#00F0FF]/60 text-white shadow-[0_0_20px_rgba(0,240,255,0.5)] border-[#00F0FF]/50' 
                  : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/15 hover:border-white/30'
              }`}
            >
              <Eraser className="w-5 h-5" />
            </motion.button>
            <motion.button 
              onClick={sendHeartReaction}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-gradient-to-tr from-[#FF00E5] to-[#FF00E5]/60 backdrop-blur-md rounded-2xl text-white shadow-[0_0_20px_rgba(255,0,229,0.5)] hover:shadow-[0_0_30px_rgba(255,0,229,0.7)] active:scale-95 transition-all border border-[#FF00E5]/30"
            >
              <Heart className="w-5 h-5 fill-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCanvas;
