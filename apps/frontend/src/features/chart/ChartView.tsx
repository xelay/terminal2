import React, { useEffect, useRef, useState } from 'react';
import {
  LogicalRange,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
  ISeriesApi,
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

  const [socket, setSocket] = useState<Socket | null>(null);

  const candlesDataRef = useRef<Candle[]>([]);
  const volumeDataRef = useRef<HistogramData<Time>[]>([]);
  const isFetchingHistory = useRef(false);

  useEffect(() => {
    const s = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000');
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const recalcVolumeFromCandles = () => {
    const vols: HistogramData<Time>[] = candlesDataRef.current.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a80' : '#ef535080',
    }));
    volumeDataRef.current = vols;
    volumeSeriesRef.current?.setData(vols);
  };

  /**
   * Синхронизирует SMA-серии на графике с текущим списком indicators:
   * - Удаляет серии для удалённых индикаторов
   * - Создаёт серии для новых индикаторов
   * - Пересчитывает и обновляет данные для всех SMA
   */
  const syncSMASeries = () => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const map = smaSeriesMapRef.current;
    const src = candlesDataRef.current;

    const activeSMAIds = new Set(
      indicators.filter((i) => i.type === 'sma').map((i) => i.id)
    );

    // Удаляем серии индикаторов, которых больше нет в store
    for (const [id, series] of map.entries()) {
      if (!activeSMAIds.has(id)) {
        chart.removeSeries(series);
        map.delete(id);
      }
    }

    // Создаём/обновляем серии для каждого активного SMA
    for (const ind of indicators.filter((i) => i.type === 'sma')) {
      const period = ind.params.period ?? 20;
      const color = ind.params.color ?? '#2962FF';

      // Создаём серию если её ещё нет
      if (!map.has(ind.id)) {
        const series: ISeriesApi<'Line'> = chart.addLineSeries({
          color,
          lineWidth: 2,
          crosshairMarkerVisible: false,
        });
        map.set(ind.id, series);
      }

      const series = map.get(ind.id)!;
      series.applyOptions({ color });

      // Пересчёт значений SMA
      if (src.length >= period) {
        const smaData: LineData<Time>[] = [];
        for (let i = period - 1; i < src.length; i++) {
          let sum = 0;
          for (let j = 0; j < period; j++) sum += src[i - j].close;
          smaData.push({ time: src[i].time as Time, value: sum / period });
        }
        series.setData(smaData);
      } else {
        series.setData([]);
      }
    }
  };

  // Первичная загрузка и подписка на realtime
  useEffect(() => {
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
          recalcVolumeFromCandles();
          syncSMASeries();
        } else {
          candlesDataRef.current = [];
          candleSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          syncSMASeries();
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
      const volArr = volumeDataRef.current;
      if (volArr.length > 0 && volArr[volArr.length - 1].time === volBar.time) {
        volArr[volArr.length - 1] = volBar;
      } else {
        volArr.push(volBar);
      }

      syncSMASeries();
    };

    socket.on('candle_update', handleCandleUpdate);

    return () => {
      socket.emit('unsubscribe_chart', { exchange, symbol, tf: timeframe });
      socket.off('candle_update', handleCandleUpdate);
      candleSeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
      candlesDataRef.current = [];
      volumeDataRef.current = [];
    };
  }, [exchange, symbol, timeframe, socket, chartRef]);

  // Реакция на изменение индикаторов (добавление, удаление, изменение настроек)
  useEffect(() => {
    syncSMASeries();
  }, [indicators]);

  // Пагинация: загрузка истории при скролле влево
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

          if (fetchedOldCandles?.length > 0) {
            const strictOld = fetchedOldCandles.filter((c: Candle) => c.time < earliestTime);
            if (strictOld.length > 0) {
              const merged = [...strictOld, ...candlesDataRef.current].sort((a, b) => a.time - b.time);
              candlesDataRef.current = merged;
              candleSeriesRef.current?.setData(
                merged.map((c) => ({
                  time: c.time as Time,
                  open: c.open, high: c.high, low: c.low, close: c.close,
                }))
              );
              recalcVolumeFromCandles();
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
    return () => { timeScale.unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged); };
  }, [exchange, symbol, timeframe, chartRef]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }} />
  );
};
