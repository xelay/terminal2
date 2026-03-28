 export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  time: number; // Unix timestamp в секундах
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeAdapter {
  id: string; // 'bybit', 'moex'
  
  // Получение исторических свечей для пагинации/первичной загрузки
  getHistoricalCandles(
    symbol: string, 
    timeframe: Timeframe, 
    fromTime?: number, // в секундах
    limit?: number
  ): Promise<Candle[]>;

  // Подписка на реалтайм обновления конкретного символа
  // Должна возвращать функцию отписки
  subscribeRealtime(
    symbol: string, 
    timeframe: Timeframe, 
    onCandleUpdate: (candle: Candle) => void
  ): () => void;
  
  // Поиск тикеров (для модалки на фронте)
  searchSymbols(query: string): Promise<string[]>;
}

