import React, { useMemo } from 'react';
import { RenkoBlock } from './renkoUtils';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

interface Props {
  blocks: RenkoBlock[];
  visibleFrom: number;
  visibleTo: number;
  containerWidth: number;
  containerHeight: number;
  rightOffset: number;
  bullColor: string;
  bearColor: string;
  opacity: number;
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  // тик пересчёта при любом движении вида
  tick: number;
}

export const RenkoOverlay: React.FC<Props> = ({
  blocks,
  visibleFrom,
  visibleTo,
  containerWidth,
  containerHeight,
  rightOffset,
  bullColor,
  bearColor,
  opacity,
  chart,
  series,
  tick,
}) => {
  const rects = useMemo(() => {
    if (!chart || !series || !visibleFrom || !visibleTo) return [];

    const chartWidth = containerWidth - rightOffset;
    if (chartWidth <= 0) return [];

    const ts = chart.timeScale();

    // Вычисляем шаг одного бара в пикселях — нужен для экстраполяции за левый край
    // Берём две ближайшие видимые точки и считаем шаг
    let pxPerSec = 0;
    const visibleBlocks = blocks.filter(b => b.timeEnd >= visibleFrom && b.timeStart <= visibleTo);

    // Находим два блока, для которых timeToCoordinate работает
    let refTime1 = 0, refX1 = 0, refTime2 = 0, refX2 = 0;
    for (const b of visibleBlocks) {
      const x1 = ts.timeToCoordinate(b.timeStart as Time);
      const x2 = ts.timeToCoordinate(b.timeEnd as Time);
      if (x1 !== null && refTime1 === 0) { refTime1 = b.timeStart; refX1 = x1; }
      if (x2 !== null) { refTime2 = b.timeEnd; refX2 = x2; }
    }
    if (refTime1 !== refTime2 && refTime2 > refTime1) {
      pxPerSec = (refX2 - refX1) / (refTime2 - refTime1);
    }

    // Помощник: получить X любого времени
    const getX = (t: number): number => {
      const coord = ts.timeToCoordinate(t as Time);
      if (coord !== null) return coord;
      // экстраполяция через знакомое опорное время
      if (pxPerSec !== 0 && refTime1 !== 0) {
        return refX1 + (t - refTime1) * pxPerSec;
      }
      return 0;
    };

    const result: Array<{
      key: number; x: number; y: number; w: number; h: number; color: string;
    }> = [];

    for (let i = 0; i < visibleBlocks.length; i++) {
      const b = visibleBlocks[i];

      const xStart = getX(b.timeStart);
      const xEnd   = getX(b.timeEnd);

      // Обрезаем по границам области свечей
      const x = Math.max(0, xStart);
      const w = Math.max(1, Math.min(chartWidth, xEnd) - x);

      const yTop    = series.priceToCoordinate(b.priceTo);
      const yBottom = series.priceToCoordinate(b.priceFrom);
      if (yTop === null || yBottom === null) continue;

      const y = Math.min(yTop, yBottom);
      const h = Math.max(1, Math.abs(yBottom - yTop));

      result.push({
        key: i, x, y, w, h,
        color: b.direction === 'up' ? bullColor : bearColor,
      });
    }

    return result;
  // tick в deps — форсируем пересчёт при любом движении
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, tick, containerWidth, rightOffset, bullColor, bearColor, opacity]);

  if (!rects.length) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: containerWidth, height: containerHeight,
      pointerEvents: 'none', zIndex: 15, overflow: 'hidden',
    }}>
      <svg width={containerWidth} height={containerHeight}>
        {rects.map(r => (
          <rect
            key={r.key}
            x={r.x} y={r.y}
            width={r.w} height={r.h}
            fill={r.color}
            fillOpacity={opacity}
          />
        ))}
      </svg>
    </div>
  );
};
