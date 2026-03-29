import React, { useEffect, useRef, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useWorkspaceStore } from '../../store/workspace';
import { DrawingTool } from '../../app/App';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const BRUSH_COLOR     = '#FFD600';
const TRENDLINE_COLOR = '#FF4081';
const BRUSH_WIDTH     = 2;
const TRENDLINE_WIDTH = 2;
const HIT_RADIUS      = 10;
const LONG_PRESS_MS   = 500;

interface DrawingPoint { time: number; price: number; }
interface Stroke {
  id: string;
  type: 'brush' | 'trendline';
  points: DrawingPoint[];
  color: string;
  width: number;
}
interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  activeTool: DrawingTool;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export const CanvasOverlay: React.FC<Props> = ({ chart, series, activeTool }) => {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const strokesRef    = useRef<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const trendStart    = useRef<DrawingPoint | null>(null);
  const mousePos      = useRef<{ x: number; y: number } | null>(null);
  const isMouseDown   = useRef(false);
  const rafRef        = useRef<number>(0);

  // Long press
  const longPressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart   = useRef<number>(0);        // timestamp
  const longPressPos     = useRef<{ x: number; y: number } | null>(null);
  const longPressFired   = useRef(false);            // сработал ли триггер
  const longPressProgress = useRef<number>(0);       // 0..1 для анимации
  const progressRafRef   = useRef<number>(0);

  const { exchange, symbol, timeframe } = useWorkspaceStore();
  const getToken = () => localStorage.getItem('jwt_token');

  // ―― API ――
  const loadDrawings = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `${API}/api/drawings?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      strokesRef.current = (data.drawings || []).map((d: any) => ({
        id: d.id, type: d.type, ...d.data,
      }));
    } catch { /* silent */ }
  }, [exchange, symbol, timeframe]);

  const saveStroke = useCallback(async (stroke: Stroke) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exchange, symbol, timeframe, type: stroke.type,
          data: { points: stroke.points, color: stroke.color, width: stroke.width },
        }),
      });
      const saved = await res.json();
      strokesRef.current = strokesRef.current.map(s =>
        s.id === stroke.id ? { ...s, id: saved.id } : s,
      );
    } catch { /* silent */ }
  }, [exchange, symbol, timeframe]);

  const deleteStroke = useCallback(async (id: string) => {
    strokesRef.current = strokesRef.current.filter(s => s.id !== id);
    if (id.startsWith('tmp-')) return;
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API}/api/drawings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* silent */ }
  }, []);

  // ―― Hit-test ――
  const findStrokeAt = useCallback((cx: number, cy: number): Stroke | null => {
    if (!chart || !series) return null;
    let best: Stroke | null = null;
    let bestDist = HIT_RADIUS;
    for (const stroke of strokesRef.current) {
      if (stroke.type === 'trendline' && stroke.points.length >= 2) {
        const A = stroke.points[0], B = stroke.points[1];
        const ax = chart.timeScale().timeToCoordinate(A.time as any);
        const ay = series.priceToCoordinate(A.price);
        const bx = chart.timeScale().timeToCoordinate(B.time as any);
        const by = series.priceToCoordinate(B.price);
        if (ax === null || ay === null || bx === null || by === null) continue;
        const d = distToSegment(cx, cy, ax, ay, bx, by);
        if (d < bestDist) { bestDist = d; best = stroke; }
      } else if (stroke.type === 'brush') {
        const pts = stroke.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const ax = chart.timeScale().timeToCoordinate(pts[i].time as any);
          const ay = series.priceToCoordinate(pts[i].price);
          const bx = chart.timeScale().timeToCoordinate(pts[i + 1].time as any);
          const by = series.priceToCoordinate(pts[i + 1].price);
          if (ax === null || ay === null || bx === null || by === null) continue;
          const d = distToSegment(cx, cy, ax, ay, bx, by);
          if (d < bestDist) { bestDist = d; best = stroke; break; }
        }
      }
    }
    return best;
  }, [chart, series]);

  // ―― Long press helpers ――
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    cancelAnimationFrame(progressRafRef.current);
    longPressProgress.current = 0;
    longPressFired.current    = false;
    longPressPos.current      = null;
  };

  const startLongPress = (x: number, y: number) => {
    cancelLongPress();
    longPressStart.current = performance.now();
    longPressPos.current   = { x, y };
    longPressFired.current = false;

    // Анимируем прогресс-дугу на canvas
    const animateProgress = () => {
      const elapsed = performance.now() - longPressStart.current;
      longPressProgress.current = Math.min(elapsed / LONG_PRESS_MS, 1);
      if (longPressProgress.current < 1 && longPressPos.current) {
        progressRafRef.current = requestAnimationFrame(animateProgress);
      }
    };
    progressRafRef.current = requestAnimationFrame(animateProgress);

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      longPressProgress.current = 0;
      if (longPressPos.current) {
        const hit = findStrokeAt(longPressPos.current.x, longPressPos.current.y);
        if (hit) deleteStroke(hit.id);
      }
      longPressPos.current = null;
    }, LONG_PRESS_MS);
  };

  // ―― Render ――
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (stroke: Stroke, previewEnd?: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth   = stroke.width;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      if (stroke.type === 'trendline') {
        const A = stroke.points[0], B = stroke.points[1];
        if (!A) return;
        const ax = chart.timeScale().timeToCoordinate(A.time as any);
        const ay = series.priceToCoordinate(A.price);
        if (ax === null || ay === null) return;
        ctx.moveTo(ax, ay);
        if (B) {
          const bx = chart.timeScale().timeToCoordinate(B.time as any);
          const by = series.priceToCoordinate(B.price);
          if (bx !== null && by !== null) ctx.lineTo(bx, by);
        } else if (previewEnd) {
          ctx.lineTo(previewEnd.x, previewEnd.y);
        }
      } else {
        let first = true;
        for (const pt of stroke.points) {
          const x = chart.timeScale().timeToCoordinate(pt.time as any);
          const y = series.priceToCoordinate(pt.price);
          if (x === null || y === null) continue;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      if (stroke.type === 'trendline') {
        [stroke.points[0], stroke.points[1]].forEach(pt => {
          if (!pt) return;
          const x = chart.timeScale().timeToCoordinate(pt.time as any);
          const y = series.priceToCoordinate(pt.price);
          if (x === null || y === null) return;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color; ctx.fill();
        });
      }
    };

    for (const stroke of strokesRef.current) drawStroke(stroke);
    if (currentStroke.current) drawStroke(currentStroke.current);

    if (activeTool === 'trendline' && trendStart.current && mousePos.current) {
      drawStroke(
        { id: 'preview', type: 'trendline', points: [trendStart.current], color: TRENDLINE_COLOR, width: TRENDLINE_WIDTH },
        mousePos.current,
      );
    }

    // Hover highlight
    if (mousePos.current && activeTool) {
      const hovered = findStrokeAt(mousePos.current.x, mousePos.current.y);
      if (hovered) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = hovered.width + 6;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        if (hovered.type === 'trendline' && hovered.points.length >= 2) {
          const A = hovered.points[0], B = hovered.points[1];
          const ax = chart.timeScale().timeToCoordinate(A.time as any);
          const ay = series.priceToCoordinate(A.price);
          const bx = chart.timeScale().timeToCoordinate(B.time as any);
          const by = series.priceToCoordinate(B.price);
          if (ax !== null && ay !== null && bx !== null && by !== null) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
        } else {
          let first = true;
          for (const pt of hovered.points) {
            const x = chart.timeScale().timeToCoordinate(pt.time as any);
            const y = series.priceToCoordinate(pt.price);
            if (x === null || y === null) continue;
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Прогресс-дуга long press: дуга вокруг курсора
    const p = longPressProgress.current;
    const lp = longPressPos.current;
    if (p > 0 && lp) {
      ctx.save();
      // Фоновая дужка
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Активная дужка
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = '#FF4081';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }, [chart, series, activeTool, findStrokeAt]);

  // ―― ResizeObserver ――
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas.parentElement!);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // ―― RAF + scale ――
  useEffect(() => {
    if (!chart || !series) return;
    const loop = () => { render(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    const onScale = () => render();
    chart.timeScale().subscribeVisibleTimeRangeChange(onScale);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onScale);
    return () => {
      cancelAnimationFrame(rafRef.current);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onScale);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onScale);
    };
  }, [chart, series, render]);

  useEffect(() => {
    strokesRef.current = [];
    trendStart.current = null;
    loadDrawings();
  }, [exchange, symbol, timeframe, loadDrawings]);

  // ―― Mouse handlers ――
  const getCoords = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { time: chart!.timeScale().coordinateToTime(x), price: series!.coordinateToPrice(y), x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeTool || !chart || !series) return;
    const { x, y, time, price } = getCoords(e);
    if (time === null || price === null) return;

    // Запускаем long press если есть что-то под курсором
    const hit = findStrokeAt(x, y);
    if (hit) { startLongPress(x, y); return; }

    if (activeTool === 'brush') {
      isMouseDown.current = true;
      currentStroke.current = {
        id: `tmp-${Date.now()}`, type: 'brush',
        points: [{ time: time as number, price }],
        color: BRUSH_COLOR, width: BRUSH_WIDTH,
      };
    }
    if (activeTool === 'trendline') {
      if (!trendStart.current) {
        trendStart.current = { time: time as number, price };
      } else {
        const stroke: Stroke = {
          id: `tmp-${Date.now()}`, type: 'trendline',
          points: [trendStart.current, { time: time as number, price }],
          color: TRENDLINE_COLOR, width: TRENDLINE_WIDTH,
        };
        strokesRef.current = [...strokesRef.current, stroke];
        saveStroke(stroke);
        trendStart.current = null;
        mousePos.current   = null;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePos.current = { x, y };

    // Движение отменяет long press
    if (longPressPos.current) {
      const dx = x - longPressPos.current.x;
      const dy = y - longPressPos.current.y;
      if (Math.hypot(dx, dy) > 5) cancelLongPress();
    }

    if (activeTool === 'brush' && isMouseDown.current && currentStroke.current && chart && series) {
      const { time, price } = getCoords(e);
      if (time !== null && price !== null) {
        currentStroke.current.points.push({ time: time as number, price });
      }
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    if (!longPressFired.current && activeTool === 'brush' && isMouseDown.current &&
      currentStroke.current && currentStroke.current.points.length > 1) {
      const stroke = { ...currentStroke.current };
      strokesRef.current = [...strokesRef.current, stroke];
      saveStroke(stroke);
    }
    currentStroke.current = null;
    isMouseDown.current   = false;
  };

  const isActive = activeTool !== null;

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { mousePos.current = null; cancelLongPress(); handleMouseUp(); }}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: isActive ? 'auto' : 'none',
        cursor: isActive ? 'crosshair' : 'default',
        zIndex: 50,
      }}
    />
  );
};
