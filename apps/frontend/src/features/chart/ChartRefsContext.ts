import { createContext, useContext } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

interface ChartRefs {
  chart:  IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
}

interface ChartRefsContextValue {
  chartRefs: ChartRefs | null;
  setChartRefs: (refs: ChartRefs) => void;
}

export const ChartRefsContext = createContext<ChartRefsContextValue>({
  chartRefs: null,
  setChartRefs: () => {},
});

export const useChartRefs = () => useContext(ChartRefsContext);
