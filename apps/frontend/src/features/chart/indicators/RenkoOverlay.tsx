import React, { useMemo } from 'react';
import { RenkoBlock } from './renkoUtils';

interface Props {
  blocks: RenkoBlock[];
  visibleFrom: number;
  visibleTo: number;
  containerWidth: number;
  containerHeight: number;
  rightOffset: number;   // ширина price scale справа
  bullColor: string;
  bearColor: string;
  opacity: number;
  priceToY: (p: number) => number | null;
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
  priceToY,
}) => {
  const rects = useMemo(() => {
    if (!visibleFrom || !visibleTo || visibleTo <= visibleFrom) return [];

    // Пиксельная ширина области свечей (без price scale справа)
    const chartWidth = containerWidth - rightOffset;
    if (chartWidth <= 0) return [];

    // Линейное отображение time → X (достаточно точное для overlay)
    const timeRange = visibleTo - visibleFrom;
    const timeToX = (t: number): number =>
      ((t - visibleFrom) / timeRange) * chartWidth;

    // Фильтруем блоки, пересекающие видимый диапазон
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

      const xStart = Math.max(0, timeToX(b.timeStart));
      const xEnd   = Math.min(chartWidth, timeToX(b.timeEnd));
      const w = Math.max(1, xEnd - xStart);

      const yTop    = priceToY(b.priceTo);
      const yBottom = priceToY(b.priceFrom);
      if (yTop === null || yBottom === null) continue;

      const y = Math.min(yTop, yBottom);
      const h = Math.max(1, Math.abs(yBottom - yTop));

      result.push({
        key: i,
        x: xStart, y, w, h,
        color: b.direction === 'up' ? bullColor : bearColor,
      });
    }

    return result;
  }, [blocks, visibleFrom, visibleTo, containerWidth, rightOffset, priceToY, bullColor, bearColor]);

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
