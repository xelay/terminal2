export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolResult {
  exchange: string;
  symbol: string;
  description: string;
}

export interface ExchangeAdapter {
  id: string;

  getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    fromTime?: number,
    limit?: number,
  ): Promise<Candle[]>;

  subscribeRealtime(
    symbol: string,
    timeframe: Timeframe,
    onCandleUpdate: (candle: Candle) => void,
  ): () => void;

  searchSymbols(query: string): Promise<SymbolResult[]>;
}
