import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { useWorkspaceStore, Theme } from '../../../store/workspace';

export const CHART_THEMES: Record<Theme, {
  bg: string; text: string; grid: string;
}> = {
  dark:  { bg: '#131722', text: '#d1d4dc', grid: '#2b2b43' },
  light: { bg: '#ffffff', text: '#131722', grid: '#e0e3eb' },
};

export function useLightweightChart(containerRef: React.RefObject<HTMLDivElement>) {
  const chartRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const { theme } = useWorkspaceStore();

  // Создание чарта
  useEffect(() => {
    if (!containerRef.current) return;
    const t = CHART_THEMES[theme];

    const chart = createChart(containerRef.current, {
      layout: { background: { color: t.bg }, textColor: t.text },
      grid:   { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current        = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    smaSeriesMapRef.current = new Map();

    const handleResize = () => {
      chart.applyOptions({
        width:  containerRef.current?.clientWidth  || 0,
        height: containerRef.current?.clientHeight || 0,
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      smaSeriesMapRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Перекраска без пересоздания при смене темы
  useEffect(() => {
    if (!chartRef.current) return;
    const t = CHART_THEMES[theme];
    chartRef.current.applyOptions({
      layout: { background: { color: t.bg }, textColor: t.text },
      grid:   { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
    });
  }, [theme]);

  return { chartRef, candleSeriesRef, volumeSeriesRef, smaSeriesMapRef };
}
