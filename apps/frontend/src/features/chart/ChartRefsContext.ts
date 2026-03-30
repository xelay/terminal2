import { createContext, useContext, MutableRefObject } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

interface ChartRefs {
  chart:  IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
}

interface ChartRefsContextValue {
  chartRefs:   ChartRefs | null;
  setChartRefs: (refs: ChartRefs) => void;
  // ref на массив свечей — мутабельный, поэтому не вызывает re-render
  candlesRef:  MutableRefObject<Candle[]> | null;
  setCandlesRef: (ref: MutableRefObject<Candle[]>) => void;
}

export const ChartRefsContext = createContext<ChartRefsContextValue>({
  chartRefs:    null,
  setChartRefs: () => {},
  candlesRef:   null,
  setCandlesRef: () => {},
});

export const useChartRefs = () => useContext(ChartRefsContext);
