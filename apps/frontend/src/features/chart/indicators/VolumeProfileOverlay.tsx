import React, { useMemo } from 'react';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

interface Props {
  candles: Candle[];
  visibleFrom: number;
  visibleTo: number;
  containerHeight: number;
  profileWidth?: number;
  rows?: number;
  color?: string;
  opacity?: number;
  priceTop: number;
  priceBottom: number;
  // Смещение влево от правого края — ширина шкалы цен
  rightOffset?: number;
}

export const VolumeProfileOverlay: React.FC<Props> = ({
  candles,
  visibleFrom,
  visibleTo,
  containerHeight,
  profileWidth = 120,
  rows = 36,
  color = '#3b82f6',
  opacity = 0.35,
  priceTop,
  priceBottom,
  rightOffset = 0,
}) => {
  const bins = useMemo(() => {
    const visible = candles.filter(c => c.time >= visibleFrom && c.time <= visibleTo);
    if (visible.length === 0) return [];

    const minPrice = Math.min(...visible.map(c => c.low));
    const maxPrice = Math.max(...visible.map(c => c.high));
    const range = maxPrice - minPrice;
    if (range <= 0) return [];

    const step = range / rows;

    const buckets = Array.from({ length: rows }, (_, i) => ({
      priceFrom: minPrice + i * step,
      priceTo:   minPrice + (i + 1) * step,
      volume: 0,
    }));

    for (const c of visible) {
      const cLow  = c.low;
      const cHigh = c.high;
      const cRange = cHigh - cLow;
      if (cRange <= 0) {
        const idx = Math.max(0, Math.min(rows - 1, Math.floor((cLow - minPrice) / step)));
        buckets[idx].volume += c.volume;
        continue;
      }
      for (let i = 0; i < rows; i++) {
        const bFrom = buckets[i].priceFrom;
        const bTo   = buckets[i].priceTo;
        const overlap = Math.max(0, Math.min(cHigh, bTo) - Math.max(cLow, bFrom));
        if (overlap > 0) {
          buckets[i].volume += c.volume * (overlap / cRange);
        }
      }
    }

    const maxVol = Math.max(...buckets.map(b => b.volume), 1);
    const priceRange = priceBottom - priceTop;

    return buckets.map((b, i) => {
      const yTop    = priceTop + ((maxPrice - b.priceTo)   / range) * priceRange;
      const yBottom = priceTop + ((maxPrice - b.priceFrom) / range) * priceRange;
      const barH = Math.max(1, yBottom - yTop - 1);
      const barW = (b.volume / maxVol) * profileWidth;
      return { key: i, x: profileWidth - barW, y: yTop, w: barW, h: barH };
    });
  }, [candles, visibleFrom, visibleTo, rows, priceTop, priceBottom, profileWidth]);

  if (!bins.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: rightOffset,   // Прижат к левому краю шкалы цен
        width: profileWidth,
        height: containerHeight,
        pointerEvents: 'none',
        zIndex: 25,
        overflow: 'hidden',
      }}
    >
      <svg width={profileWidth} height={containerHeight}>
        {bins.map(b => (
          <rect
            key={b.key}
            x={b.x}
            y={b.y}
            width={Math.max(1, b.w)}
            height={b.h}
            rx={1}
            fill={color}
            fillOpacity={opacity}
          />
        ))}
      </svg>
    </div>
  );
};
