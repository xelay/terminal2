import React, { useMemo } from 'react';
import { RenkoBlock } from './renkoUtils';

interface Props {
  blocks: RenkoBlock[];
  visibleFrom: number;
  visibleTo: number;
  containerWidth: number;
  containerHeight: number;
  bullColor: string;
  bearColor: string;
  opacity: number;
  // Функции конвертации координат из ChartView
  timeToX: (t: number) => number | null;
  priceToY: (p: number) => number | null;
}

export const RenkoOverlay: React.FC<Props> = ({
  blocks,
  visibleFrom,
  visibleTo,
  containerWidth,
  containerHeight,
  bullColor,
  bearColor,
  opacity,
  timeToX,
  priceToY,
}) => {
  const rects = useMemo(() => {
    // Фильтруем только блоки, которые попадают в видимый диапазон
    const visible = blocks.filter(
      b => b.timeEnd >= visibleFrom && b.timeStart <= visibleTo
    );

    const result: Array<{
      key: number;
      x: number; y: number; w: number; h: number;
      color: string;
    }> = [];

    for (let i = 0; i < visible.length; i++) {
      const b = visible[i];

      // X: от timeStart до timeEnd
      // Если timeStart вышел за левый край — прижимаем к 0
      const xStart = timeToX(b.timeStart);
      const xEnd   = timeToX(b.timeEnd);
      if (xStart === null || xEnd === null) continue;

      const x = Math.max(0, xStart);
      const w = Math.max(1, Math.min(containerWidth, xEnd) - x);

      // Y: priceToY(priceTo) — верхняя точка, priceToY(priceFrom) — нижняя
      const yTop    = priceToY(b.priceTo);
      const yBottom = priceToY(b.priceFrom);
      if (yTop === null || yBottom === null) continue;

      const y = Math.min(yTop, yBottom);
      const h = Math.max(1, Math.abs(yBottom - yTop));

      result.push({
        key: i,
        x, y, w, h,
        color: b.direction === 'up' ? bullColor : bearColor,
      });
    }

    return result;
  }, [blocks, visibleFrom, visibleTo, timeToX, priceToY, bullColor, bearColor]);

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
