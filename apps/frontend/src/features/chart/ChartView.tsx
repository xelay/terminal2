import React, { useEffect, useRef, useState } from 'react';
import { LogicalRange, Time, HistogramData, LineData } from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';
import { useWorkspaceStore } from '../../store/workspace';
import { useLightweightChart } from './lwc/useLightweightChart';
import { useChartRefs } from './ChartRefsContext';
import { VolumeProfileOverlay } from './indicators/VolumeProfileOverlay';

const tfToSeconds: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900,
  '1h': 3600, '4h': 14400, '1d': 86400,
  '1w': 604800, '1M': 2592000,
};

type Candle = {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};

export const ChartView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { chartRef, candleSeriesRef, volumeSeriesRef, smaSeriesMapRef } =
    useLightweightChart(containerRef);

  const { setChartRefs } = useChartRefs();
  const { exchange, symbol, timeframe, indicators } = useWorkspaceStore();

  const socketRef           = useRef<Socket | null>(null);
  const candlesDataRef      = useRef<Candle[]>([]);
  const isFetchingHistory   = useRef(false);
  const indicatorsRef       = useRef(indicators);

  // Volume Profile state
  const [visibleRange, setVisibleRange]   = useState<{ from: number; to: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // Ценовая область чарта (в px от верху контейнера)
  const [priceArea, setPriceArea]         = useState({ top: 0, bottom: 0 });

  useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);

  useEffect(() => {
    if (chartRef.current && candleSeriesRef.current) {
      setChartRefs({ chart: chartRef.current, series: candleSeriesRef.current });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRef.current, candleSeriesRef.current]);

  // ―― Отслеживаем размер контейнера ――
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ―― Отслеживаем видимый диапазон времени ――
  useEffect(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const update = () => {
      const r = ts.getVisibleRange();
      if (r) setVisibleRange({ from: Number(r.from), to: Number(r.to) });
    };
    update();
    ts.subscribeVisibleTimeRangeChange(update);
    return () => ts.unsubscribeVisibleTimeRangeChange(update);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRef.current]);

  // ―― Отслеживаем ценовую область чарта (px) ――
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    const update = () => {
      if (!candleSeriesRef.current) return;
      const ps = candleSeriesRef.current.priceScale();
      // Берём видимый ценовой диапазон через priceToCoordinate
      const visible = candlesDataRef.current.filter(
        c => visibleRange ? c.time >= visibleRange.from && c.time <= visibleRange.to : true
      );
      if (!visible.length) return;
      const minP = Math.min(...visible.map(c => c.low));
      const maxP = Math.max(...visible.map(c => c.high));
      const topY    = candleSeriesRef.current.priceToCoordinate(maxP);
      const bottomY = candleSeriesRef.current.priceToCoordinate(minP);
      if (topY !== null && bottomY !== null) {
        setPriceArea({ top: topY, bottom: bottomY });
      }
    };
    update();
    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(update);
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(update);
    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(update);
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(update);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRef.current, candleSeriesRef.current, visibleRange]);

  const syncVolume = () => {
    const hasVolume = indicatorsRef.current.some(i => i.type === 'volume');
    if (!hasVolume) { volumeSeriesRef.current?.setData([]); return; }
    const vols: HistogramData<Time>[] = candlesDataRef.current.map(c => ({
      time: c.time as Time, value: c.volume,
      color: c.close >= c.open ? '#26a69a80' : '#ef535080',
    }));
    volumeSeriesRef.current?.setData(vols);
  };

  const syncSMASeries = () => {
    if (!chartRef.current) return;
    const smaIndicators = indicatorsRef.current.filter(i => i.type === 'sma');
    const map = smaSeriesMapRef.current;
    const src = candlesDataRef.current;
    for (const [id, series] of map.entries()) {
      if (!smaIndicators.find(i => i.id === id)) {
        chartRef.current.removeSeries(series); map.delete(id);
      }
    }
    for (const ind of smaIndicators) {
      const period = ind.params.period ?? 20;
      const color  = ind.params.color  ?? '#2962FF';
      if (!map.has(ind.id)) {
        const s = chartRef.current.addLineSeries({
          color, lineWidth: 2,
          crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
        });
        map.set(ind.id, s);
      }
      const series = map.get(ind.id)!;
      series.applyOptions({ color });
      if (src.length < period) { series.setData([]); continue; }
      const smaData: LineData<Time>[] = [];
      for (let i = period - 1; i < src.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += src[i - j].close;
        smaData.push({ time: src[i].time as Time, value: sum / period });
      }
      series.setData(smaData);
    }
  };

  useEffect(() => {
    const s = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000');
    socketRef.current = s;
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !chartRef.current) return;

    const loadInitialData = async () => {
      try {
        isFetchingHistory.current = true;
        const res = await fetch(
          `http://localhost:3000/api/market/history?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=500`,
        );
        const { candles } = await res.json();
        if (candles && candles.length > 0) {
          const raw: Candle[] = candles.slice().sort((a: Candle, b: Candle) => a.time - b.time);
          candlesDataRef.current = raw;
          candleSeriesRef.current?.setData(
            raw.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
          );
          syncVolume(); syncSMASeries();
        } else {
          candlesDataRef.current = [];
          candleSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          for (const s of smaSeriesMapRef.current.values()) s.setData([]);
        }
      } catch (e) {
        console.error('loadInitialData error', e);
      } finally {
        isFetchingHistory.current = false;
      }
    };

    loadInitialData();
    socket.emit('subscribe_chart', { exchange, symbol, tf: timeframe });

    const handleCandleUpdate = (payload: any) => {
      if (payload.symbol !== symbol || payload.tf !== timeframe) return;
      const newCandle: Candle = payload.candle;
      const current = candlesDataRef.current;
      if (current.length > 0) {
        const last = current[current.length - 1];
        if (newCandle.time < last.time) return;
        if (newCandle.time === last.time) current[current.length - 1] = newCandle;
        else current.push(newCandle);
      } else { current.push(newCandle); }
      candleSeriesRef.current?.update({
        time: newCandle.time as Time, open: newCandle.open,
        high: newCandle.high, low: newCandle.low, close: newCandle.close,
      });
      if (indicatorsRef.current.some(i => i.type === 'volume')) {
        volumeSeriesRef.current?.update({
          time: newCandle.time as Time, value: newCandle.volume,
          color: newCandle.close >= newCandle.open ? '#26a69a80' : '#ef535080',
        });
      }
      syncSMASeries();
    };

    socket.on('candle_update', handleCandleUpdate);
    return () => {
      socket.emit('unsubscribe_chart', { exchange, symbol, tf: timeframe });
      socket.off('candle_update', handleCandleUpdate);
      candlesDataRef.current = [];
      candleSeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
    };
  }, [exchange, symbol, timeframe, chartRef]);

  useEffect(() => { syncVolume(); syncSMASeries(); }, [indicators]);

  useEffect(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const onRange = async (newLogicalRange: LogicalRange | null) => {
      if (!newLogicalRange) return;
      if (newLogicalRange.from < 50 && !isFetchingHistory.current && candlesDataRef.current.length > 0) {
        isFetchingHistory.current = true;
        try {
          const earliestTime = candlesDataRef.current[0].time;
          const fromTime = earliestTime - 500 * (tfToSeconds[timeframe] || 60);
          const res = await fetch(
            `http://localhost:3000/api/market/history?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=500&from=${fromTime}`,
          );
          const { candles: old } = await res.json();
          if (old && old.length > 0) {
            const strictOld = old.filter((c: Candle) => c.time < earliestTime);
            if (strictOld.length > 0) {
              const merged = [...strictOld, ...candlesDataRef.current].sort((a: Candle, b: Candle) => a.time - b.time);
              candlesDataRef.current = merged;
              candleSeriesRef.current?.setData(
                merged.map((c: Candle) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
              );
              syncVolume(); syncSMASeries();
            }
          }
        } catch (e) {
          console.error('pagination error', e);
        } finally {
          isFetchingHistory.current = false;
        }
      }
    };
    timeScale.subscribeVisibleLogicalRangeChange(onRange);
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(onRange);
  }, [exchange, symbol, timeframe, chartRef]);

  const vpIndicator = indicators.find(i => i.type === 'volume_profile');

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {vpIndicator && visibleRange && priceArea.bottom > priceArea.top && (
        <VolumeProfileOverlay
          candles={candlesDataRef.current}
          visibleFrom={visibleRange.from}
          visibleTo={visibleRange.to}
          containerHeight={containerSize.height}
          profileWidth={vpIndicator.params.profileWidth ?? 120}
          rows={vpIndicator.params.rows ?? 36}
          color={vpIndicator.params.color ?? '#3b82f6'}
          opacity={vpIndicator.params.opacity ?? 0.35}
          priceTop={priceArea.top}
          priceBottom={priceArea.bottom}
        />
      )}
    </div>
  );
};
