import React, { useEffect, useRef, useState } from 'react';
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

// Маппинг таймфреймов в секунды (для расчета fromTime при догрузке истории)
const tfToSeconds: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

type Candle = {
  time: number; // unix в секундах
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const ChartView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { chartRef, candleSeriesRef, volumeSeriesRef, smaSeriesRef } =
    useLightweightChart(containerRef);

  const { exchange, symbol, timeframe, indicators } = useWorkspaceStore();

  const [socket, setSocket] = useState<Socket | null>(null);

  const candlesDataRef = useRef<Candle[]>([]);
  const volumeDataRef = useRef<HistogramData<Time>[]>([]);
  const smaDataRef = useRef<LineData<Time>[]>([]);
  const isFetchingHistory = useRef(false);

  // Инициализация WebSocket
  useEffect(() => {
    const s = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000');
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Хелпер: пересчет объема из текущих свечей
  const recalcVolumeFromCandles = () => {
    const vols: HistogramData<Time>[] = candlesDataRef.current.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a80' : '#ef535080',
    }));
    volumeDataRef.current = vols;
    volumeSeriesRef.current?.setData(vols);
  };

  // Хелпер: пересчет SMA из текущих свечей и настроек
  const recalcSMAFromCandles = () => {
    const smaIndicator = indicators.find((i) => i.type === 'sma');
    if (!smaIndicator || !smaSeriesRef.current) {
      smaSeriesRef.current?.setData([]);
      smaDataRef.current = [];
      return;
    }

    const period = smaIndicator.params.period ?? 20;
    const color = smaIndicator.params.color ?? '#2962FF';
    const src = candlesDataRef.current;

    if (src.length < period) {
      smaSeriesRef.current.setData([]);
      smaDataRef.current = [];
      return;
    }

    const sma: LineData<Time>[] = [];

    for (let i = period - 1; i < src.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += src[i - j].close;
      }
      sma.push({
        time: src[i].time as Time,
        value: sum / period,
      });
    }

    smaDataRef.current = sma;
    smaSeriesRef.current.setData(sma);
    smaSeriesRef.current.applyOptions({ color });
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
          const raw: Candle[] = candles
            .slice()
            .sort((a: Candle, b: Candle) => a.time - b.time);

          candlesDataRef.current = raw;

          const candleSeriesData: CandlestickData<Time>[] = raw.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));

          candleSeriesRef.current?.setData(candleSeriesData);
          recalcVolumeFromCandles();
          recalcSMAFromCandles();
        } else {
          candlesDataRef.current = [];
          candleSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          smaSeriesRef.current?.setData([]);
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

        if (newCandle.time < last.time) {
          return; // защита от старых апдейтов
        }

        if (newCandle.time === last.time) {
          current[current.length - 1] = newCandle;
        } else {
          current.push(newCandle);
        }
      } else {
        current.push(newCandle);
      }

      // обновляем свечу
      candleSeriesRef.current?.update({
        time: newCandle.time as Time,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close,
      });

      // обновляем объем (хвостик)
      const volBar: HistogramData<Time> = {
        time: newCandle.time as Time,
        value: newCandle.volume,
        color:
          newCandle.close >= newCandle.open ? '#26a69a80' : '#ef535080',
      };
      volumeSeriesRef.current?.update(volBar);

      const volArr = volumeDataRef.current;
      if (volArr.length > 0 && volArr[volArr.length - 1].time === volBar.time) {
        volArr[volArr.length - 1] = volBar;
      } else {
        volArr.push(volBar);
      }

      // пересчитываем хвостик SMA (упрощённо — по всему массиву)
      recalcSMAFromCandles();
    };

    socket.on('candle_update', handleCandleUpdate);

    return () => {
      socket.emit('unsubscribe_chart', { exchange, symbol, tf: timeframe });
      socket.off('candle_update', handleCandleUpdate);
      candleSeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
      smaSeriesRef.current?.setData([]);
      candlesDataRef.current = [];
      volumeDataRef.current = [];
      smaDataRef.current = [];
    };
  }, [
    exchange,
    symbol,
    timeframe,
    socket,
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    smaSeriesRef,
    indicators,
  ]);

  // Пересчет SMA при изменении настроек индикаторов
  useEffect(() => {
    if (!chartRef.current) return;
    recalcSMAFromCandles();
  }, [indicators, chartRef]);

  // Пагинация: загрузка старой истории при скролле влево
  useEffect(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();

    const onVisibleLogicalRangeChanged = async (
      newLogicalRange: LogicalRange | null,
    ) => {
      if (!newLogicalRange) return;

      if (
        newLogicalRange.from < 50 &&
        !isFetchingHistory.current &&
        candlesDataRef.current.length > 0
      ) {
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
            const strictOld: Candle[] = fetchedOldCandles.filter(
              (c: Candle) => c.time < earliestTime,
            );

            if (strictOld.length > 0) {
              const mergedRaw = [...strictOld, ...candlesDataRef.current].sort(
                (a, b) => a.time - b.time,
              );
              candlesDataRef.current = mergedRaw;

              const mergedSeries: CandlestickData<Time>[] = mergedRaw.map(
                (c) => ({
                  time: c.time as Time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                }),
              );

              candleSeriesRef.current?.setData(mergedSeries);
              recalcVolumeFromCandles();
              recalcSMAFromCandles();
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
      timeScale.unsubscribeVisibleLogicalRangeChange(
        onVisibleLogicalRangeChanged,
      );
    };
  }, [exchange, symbol, timeframe, chartRef, candleSeriesRef]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    />
  );
};
