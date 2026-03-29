import React, { useEffect, useRef, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useWorkspaceStore } from '../../store/workspace';
import { DrawingTool } from '../../app/App';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const BRUSH_COLOR     = '#FFD600';
const TRENDLINE_COLOR = '#FF4081';
const BRUSH_WIDTH     = 2;
const TRENDLINE_WIDTH = 2;

interface DrawingPoint { time: number; price: number; }

interface Stroke {
  id: string;
  type: 'brush' | 'trendline';
  points: DrawingPoint[];  // brush: много | trendline: [ТочкаA, ТочкаB]
  color: string;
  width: number;
}

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  activeTool: DrawingTool;
}

export const CanvasOverlay: React.FC<Props> = ({ chart, series, activeTool }) => {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const strokesRef    = useRef<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  // для trendline: ждём второго клика
  const trendStart    = useRef<DrawingPoint | null>(null);
  // позиция мыши для превью trendline
  const mousePos      = useRef<{ x: number; y: number } | null>(null);
  const isMouseDown   = useRef(false);
  const rafRef        = useRef<number>(0);

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
          exchange, symbol, timeframe,
          type: stroke.type,
          data: { points: stroke.points, color: stroke.color, width: stroke.width },
        }),
      });
      const saved = await res.json();
      strokesRef.current = strokesRef.current.map(s =>
        s.id === stroke.id ? { ...s, id: saved.id } : s,
      );
    } catch { /* silent */ }
  }, [exchange, symbol, timeframe]);

  // ―― Render ――
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем все сохранённые
    const drawStroke = (stroke: Stroke, previewEnd?: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth   = stroke.width;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';

      if (stroke.type === 'trendline') {
        // Простая линия A → B
        const A = stroke.points[0];
        const B = stroke.points[1];
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
        // Brush: цепочка точек
        let first = true;
        for (const pt of stroke.points) {
          const x = chart.timeScale().timeToCoordinate(pt.time as any);
          const y = series.priceToCoordinate(pt.price);
          if (x === null || y === null) continue;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Точки на концах трендлинии
      if (stroke.type === 'trendline') {
        [stroke.points[0], stroke.points[1]].forEach(pt => {
          if (!pt) return;
          const x = chart.timeScale().timeToCoordinate(pt.time as any);
          const y = series.priceToCoordinate(pt.price);
          if (x === null || y === null) return;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
        });
      }
    };

    for (const stroke of strokesRef.current) drawStroke(stroke);

    // Текущий мазок (brush)
    if (currentStroke.current) drawStroke(currentStroke.current);

    // Превью trendline: первая точка есть, вторая ещё не поставлена
    if (activeTool === 'trendline' && trendStart.current && mousePos.current) {
      drawStroke(
        {
          id: 'preview', type: 'trendline',
          points: [trendStart.current],
          color: TRENDLINE_COLOR, width: TRENDLINE_WIDTH,
        },
        mousePos.current,
      );
    }
  }, [chart, series, activeTool]);

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

  // ―― RAF + scale subscription ――
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

  // ―― Загрузка при смене инструмента ――
  useEffect(() => {
    strokesRef.current = [];
    trendStart.current = null;
    loadDrawings();
  }, [exchange, symbol, timeframe, loadDrawings]);

  // ―― Mouse handlers ――
  const getTimePriceFromEvent = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time  = chart!.timeScale().coordinateToTime(x);
    const price = series!.coordinateToPrice(y);
    return { time, price, x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeTool || !chart || !series) return;

    const { time, price } = getTimePriceFromEvent(e);
    if (time === null || price === null) return;

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
        // Первый клик — фиксируем точку A
        trendStart.current = { time: time as number, price };
      } else {
        // Второй клик — фиксируем точку B и сохраняем
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
    mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (activeTool === 'brush' && isMouseDown.current && currentStroke.current && chart && series) {
      const { time, price } = getTimePriceFromEvent(e);
      if (time !== null && price !== null) {
        currentStroke.current.points.push({ time: time as number, price });
      }
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'brush' && isMouseDown.current && currentStroke.current && currentStroke.current.points.length > 1) {
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
      onMouseLeave={() => { mousePos.current = null; handleMouseUp(); }}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: isActive ? 'auto' : 'none',
        cursor: isActive
          ? activeTool === 'trendline' ? 'crosshair' : 'crosshair'
          : 'default',
        zIndex: 50,
      }}
    />
  );
};
