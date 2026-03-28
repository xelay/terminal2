 
import React, { useEffect, useRef, useState } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

interface DrawingPoint {
  time: number; // Logical time / Unix timestamp
  price: number;
}

interface Stroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
}

interface CanvasOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  isDrawingMode: boolean; // Включается из Toolbar
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({ chart, series, isDrawingMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const isMouseDown = useRef(false);

  // Основной цикл синхронизации координат (перерисовка при движении графика)
  useEffect(() => {
    if (!chart || !series || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const allStrokes = currentStroke.current ? [...strokes, currentStroke.current] : strokes;

      allStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        stroke.points.forEach((point, index) => {
          // Конвертируем Time/Price обратно в X/Y экрана
          const x = chart.timeScale().timeToCoordinate(point.time as any);
          const y = series.priceToCoordinate(point.price);
          
          if (x !== null && y !== null) {
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      });
    };

    // Подписываемся на изменения масштаба и времени, чтобы рисунок "прилипал" к свечам
    chart.timeScale().subscribeVisibleTimeRangeChange(render);
    chart.timeScale().subscribeVisibleLogicalRangeChange(render);
    
    // Также можно использовать requestAnimationFrame для плавности при ресайзе
    const animFrame = requestAnimationFrame(function loop() {
      render();
      requestAnimationFrame(loop);
    });

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(render);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(render);
      cancelAnimationFrame(animFrame);
    };
  }, [chart, series, strokes]);

  // Обработчики мыши (Кисть)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingMode || !chart || !series) return;
    isMouseDown.current = true;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Конвертируем X/Y в Time/Price TradingView
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);

    if (time && price !== null) {
      currentStroke.current = {
        id: Date.now().toString(),
        points: [{ time: time as number, price }],
        color: '#2962FF',
        width: 3
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !currentStroke.current || !chart || !series) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);

    if (time && price !== null) {
      currentStroke.current.points.push({ time: time as number, price });
    }
  };

  const handleMouseUp = () => {
    if (isMouseDown.current && currentStroke.current) {
      setStrokes(prev => [...prev, currentStroke.current!]);
      currentStroke.current = null;
    }
    isMouseDown.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      // Если не в режиме рисования, клики проваливаются сквозь канвас на сам график
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: isDrawingMode ? 'auto' : 'none',
        zIndex: 50
      }}
      width={window.innerWidth}   // В реальности берем ширину/высоту из ResizeObserver контейнера
      height={window.innerHeight}
    />
  );
};
