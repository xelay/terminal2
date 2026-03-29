import React, { useEffect, useRef, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useWorkspaceStore } from '../../store/workspace';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface DrawingPoint {
  time: number;
  price: number;
}

interface Stroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
}

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  isDrawingMode: boolean;
}

export const CanvasOverlay: React.FC<Props> = ({ chart, series, isDrawingMode }) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const strokesRef     = useRef<Stroke[]>([]);
  const currentStroke  = useRef<Stroke | null>(null);
  const isMouseDown    = useRef(false);
  const rafRef         = useRef<number>(0);

  const { exchange, symbol, timeframe } = useWorkspaceStore();

  const getToken = () => localStorage.getItem('jwt_token');

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
        id: d.id,
        ...d.data,
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
          exchange, symbol, timeframe,
          type: 'brush',
          data: { points: stroke.points, color: stroke.color, width: stroke.width },
        }),
      });
      const saved = await res.json();
      strokesRef.current = strokesRef.current.map((s) =>
        s.id === stroke.id ? { ...s, id: saved.id } : s,
      );
    } catch { /* silent */ }
  }, [exchange, symbol, timeframe]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const all = currentStroke.current
      ? [...strokesRef.current, currentStroke.current]
      : strokesRef.current;

    for (const stroke of all) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth   = stroke.width;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';

      let first = true;
      for (const pt of stroke.points) {
        const x = chart.timeScale().timeToCoordinate(pt.time as any);
        const y = series.priceToCoordinate(pt.price);
        if (x === null || y === null) continue;
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [chart, series]);

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
    loadDrawings();
  }, [exchange, symbol, timeframe, loadDrawings]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingMode || !chart || !series) return;
    isMouseDown.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    const time  = chart.timeScale().coordinateToTime(e.clientX - rect.left);
    const price = series.coordinateToPrice(e.clientY - rect.top);
    if (time !== null && price !== null) {
      currentStroke.current = {
        id: `tmp-${Date.now()}`,
        points: [{ time: time as number, price }],
        color: '#FFD600',
        width: 2,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !currentStroke.current || !chart || !series) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const time  = chart.timeScale().coordinateToTime(e.clientX - rect.left);
    const price = series.coordinateToPrice(e.clientY - rect.top);
    if (time !== null && price !== null) {
      currentStroke.current.points.push({ time: time as number, price });
    }
  };

  const handleMouseUp = () => {
    if (isMouseDown.current && currentStroke.current && currentStroke.current.points.length > 1) {
      const stroke = { ...currentStroke.current };
      strokesRef.current = [...strokesRef.current, stroke];
      saveStroke(stroke);
    }
    currentStroke.current = null;
    isMouseDown.current   = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: isDrawingMode ? 'auto' : 'none',
        cursor: isDrawingMode ? 'crosshair' : 'default',
        zIndex: 50,
      }}
    />
  );
};
