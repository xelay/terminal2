import React, { useEffect, useRef } from 'react';
import {
  LogicalRange,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
} from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';
import { useWorkspaceStore } from '../../store/workspace';
import { useLightweightChart } from './lwc/useLightweightChart';

const tfToSeconds: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const ChartView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { chartRef, candleSeriesRef, volumeSeriesRef, smaSeriesMapRef } =
    useLightweightChart(containerRef);

  const { exchange, symbol, timeframe, indicators } = useWorkspaceStore();

  const socketRef = useRef<Socket | null>(null);
  const candlesDataRef = useRef<Candle[]>([]);
  const isFetchingHistory = useRef(false);

  // Храним актуальный список индикаторов в ref,
  // чтобы handleCandleUpdate всегда читал свежее значение без пересоздания подписки
  const indicatorsRef = useRef(indicators);
  useEffect(() => {
    indicatorsRef.current = indicators;
  }, [indicators]);

  // Синхронизация SMA-серий — читает из indicatorsRef, а не из замыкания
  const syncSMASeries = () => {
    if (!chartRef.current) return;

    const smaIndicators = indicatorsRef.current.filter((i) => i.type === 'sma');
    const map = smaSeriesMapRef.current;
    const src = candlesDataRef.current;

    // Удалить серии для удалённых индикаторов
    for (const [id, series] of map.entries()) {
      if (!smaIndicators.find((i) => i.id === id)) {
        chartRef.current.removeSeries(series);
        map.delete(id);
      }
    }

    // Добавить/обновить серии
    for (const ind of smaIndicators) {
      const period = ind.params.period ?? 20;
      const color = ind.params.color ?? '#2962FF';

      if (!map.has(ind.id)) {
        const series = chartRef.current.addLineSeries({
          color,
          lineWidth: 2,
          crosshairMarkerVisible: false,
        });
        map.set(ind.id, series);
      }

      const series = map.get(ind.id)!;
      series.applyOptions({ color });

      if (src.length < period) {
        series.setData([]);
        continue;
      }

      const smaData: LineData<Time>[] = [];
      for (let i = period - 1; i < src.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += src[i - j].close;
        smaData.push({ time: src[i].time as Time, value: sum / period });
      }
      series.setData(smaData);
    }
  };

  const recalcVolume = () => {
    const vols: HistogramData<Time>[] = candlesDataRef.current.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a80' : '#ef535080',
    }));
    volumeSeriesRef.current?.setData(vols);
  };

  // WebSocket — создаётся один раз
  useEffect(() => {
    const s = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000');
    socketRef.current = s;
    return () => { s.disconnect(); };
  }, []);

  // Загрузка данных и подписка — пересоздаётся только при смене пары/символа/таймфрейма
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !chartRef.current) return;

    const loadInitialData = async () => {
      try {
        isFetchingHistory.current = true;
        const res = await fetch(
          `http://localhost:3000/api/market/history?exchange=${exchange}&symbol=${symbol}&tf=${timeframe}&limit=500`,
        );
        const { candles } = await res.json();

        if (candles && candles.length > 0) {
          const raw: Candle[] = candles.slice().sort((a: Candle, b: Candle) => a.time - b.time);
          candlesDataRef.current = raw;
          candleSeriesRef.current?.setData(
            raw.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
          recalcVolume();
          syncSMASeries();
        } else {
          candlesDataRef.current = [];
          candleSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          for (const series of smaSeriesMapRef.current.values()) series.setData([]);
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
      } else {
        current.push(newCandle);
      }

      candleSeriesRef.current?.update({
        time: newCandle.time as Time,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close,
      });

      const volBar: HistogramData<Time> = {
        time: newCandle.time as Time,
        value: newCandle.volume,
        color: newCandle.close >= newCandle.open ? '#26a69a80' : '#ef535080',
      };
      volumeSeriesRef.current?.update(volBar);

      // Читаем indicatorsRef.current — всегда актуальный список
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

  // Пересинхронизация SMA при изменении индикаторов
  useEffect(() => {
    syncSMASeries();
  }, [indicators]);

  // Пагинация
  useEffect(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();

    const onVisibleLogicalRangeChanged = async (newLogicalRange: LogicalRange | null) => {
      if (!newLogicalRange) return;
      if (newLogicalRange.from < 50 && !isFetchingHistory.current && candlesDataRef.current.length > 0) {
        isFetchingHistory.current = true;
        try {
          const earliestTime = candlesDataRef.current[0].time;
          const tfSec = tfToSeconds[timeframe] || 60;
          const fromTime = earliestTime - 500 * tfSec;

          const res = await fetch(
            `http://localhost:3000/api/market/history?exchange=${exchange}&symbol=${symbol}&tf=${timeframe}&limit=500&from=${fromTime}`,
          );
          const { candles: fetchedOldCandles } = await res.json();

          if (fetchedOldCandles && fetchedOldCandles.length > 0) {
            const strictOld = fetchedOldCandles.filter(
              (c: Candle) => c.time < earliestTime,
            );
            if (strictOld.length > 0) {
              const merged = [...strictOld, ...candlesDataRef.current].sort((a: Candle, b: Candle) => a.time - b.time);
              candlesDataRef.current = merged;
              candleSeriesRef.current?.setData(
                merged.map((c: Candle) => ({
                  time: c.time as Time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                }))
              );
              recalcVolume();
              syncSMASeries();
            }
          }
        } catch (e) {
          console.error('pagination error', e);
        } finally {
          isFetchingHistory.current = false;
        }
      }
    };

    timeScale.subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
    };
  }, [exchange, symbol, timeframe, chartRef]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    />
  );
};
