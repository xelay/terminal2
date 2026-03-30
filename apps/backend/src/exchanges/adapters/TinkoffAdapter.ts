import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe, SymbolResult } from '../types';

const BASE = 'https://invest-public-api.tinkoff.ru/rest';

// Маппинг фреймов в CandleInterval Tinkoff API
const TF_TO_INTERVAL: Record<Timeframe, string> = {
  '1m':  'CANDLE_INTERVAL_1_MIN',
  '5m':  'CANDLE_INTERVAL_5_MIN',
  '15m': 'CANDLE_INTERVAL_15_MIN',
  '1h':  'CANDLE_INTERVAL_HOUR',
  '4h':  'CANDLE_INTERVAL_4_HOUR',
  '1d':  'CANDLE_INTERVAL_DAY',
  '1w':  'CANDLE_INTERVAL_WEEK',
  '1M':  'CANDLE_INTERVAL_MONTH',
};

// Максимальный диапазон одного запроса (ms) — ограничение Tinkoff API
const TF_MAX_RANGE_MS: Record<Timeframe, number> = {
  '1m':  60 * 60 * 1000,           // 1 час
  '5m':  24 * 60 * 60 * 1000,      // 1 день
  '15m': 7 * 24 * 60 * 60 * 1000,  // 1 неделя
  '1h':  7 * 24 * 60 * 60 * 1000,  // 1 неделя
  '4h':  30 * 24 * 60 * 60 * 1000, // 1 месяц
  '1d':  365 * 24 * 60 * 60 * 1000,// 1 год
  '1w':  2 * 365 * 24 * 60 * 60 * 1000,
  '1M':  5 * 365 * 24 * 60 * 60 * 1000,
};

// Шаг одного запроса (ms) для итерации назад
const TF_STEP_MS: Record<Timeframe, number> = {
  '1m':  55 * 60 * 1000,
  '5m':  23 * 60 * 60 * 1000,
  '15m': 6 * 24 * 60 * 60 * 1000,
  '1h':  6 * 24 * 60 * 60 * 1000,
  '4h':  28 * 24 * 60 * 60 * 1000,
  '1d':  360 * 24 * 60 * 60 * 1000,
  '1w':  700 * 24 * 60 * 60 * 1000,
  '1M':  1800 * 24 * 60 * 60 * 1000,
};

function quotationToNumber(q: { units: string; nano: number } | undefined): number {
  if (!q) return 0;
  return parseFloat(q.units) + q.nano / 1e9;
}

function parseCandle(c: any): Candle {
  return {
    time:   Math.floor(new Date(c.time).getTime() / 1000),
    open:   quotationToNumber(c.open),
    high:   quotationToNumber(c.high),
    low:    quotationToNumber(c.low),
    close:  quotationToNumber(c.close),
    volume: Number(c.volume ?? 0),
  };
}

export class TinkoffAdapter implements ExchangeAdapter {
  public id = 'tinkoff';
  private token: string;
  // Кэш symbol -> figi
  private figiCache = new Map<string, string>();

  constructor() {
    this.token = process.env.TINKOFF_TOKEN ?? '';
    if (!this.token) {
      console.warn('[TinkoffAdapter] TINKOFF_TOKEN not set — adapter disabled');
    }
  }

  private get headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async getFigi(ticker: string): Promise<string | null> {
    if (this.figiCache.has(ticker)) return this.figiCache.get(ticker)!;
    try {
      const res = await axios.post(
        `${BASE}/tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument`,
        { query: ticker, instrumentKind: 'INSTRUMENT_TYPE_SHARE', apiTradeAvailableFlag: true },
        { headers: this.headers },
      );
      const instruments: any[] = res.data?.instruments ?? [];
      // Точное совпадение tickerа
      const match = instruments.find(i => i.ticker === ticker) ?? instruments[0];
      if (!match) return null;
      const figi = match.figi as string;
      this.figiCache.set(ticker, figi);
      return figi;
    } catch (e) {
      console.error('[Tinkoff] getFigi error:', e);
      return null;
    }
  }

  private async fetchCandleChunk(
    figi: string,
    tf: Timeframe,
    fromMs: number,
    toMs: number,
  ): Promise<Candle[]> {
    const res = await axios.post(
      `${BASE}/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles`,
      {
        figi,
        from: new Date(fromMs).toISOString(),
        to:   new Date(toMs).toISOString(),
        interval: TF_TO_INTERVAL[tf],
        instrumentId: figi,
      },
      { headers: this.headers },
    );
    return (res.data?.candles ?? []).map(parseCandle).filter((c: Candle) => c.open > 0);
  }

  async getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    fromTime?: number,
    limit = 500,
  ): Promise<Candle[]> {
    if (!this.token) return [];
    const figi = await this.getFigi(symbol);
    if (!figi) return [];

    const stepMs = TF_STEP_MS[timeframe];
    let toMs = fromTime ? fromTime * 1000 : Date.now();
    let collected: Candle[] = [];
    const MAX_ITERS = 20;

    for (let i = 0; i < MAX_ITERS && collected.length < limit; i++) {
      const fromMs = toMs - stepMs;
      try {
        const chunk = await this.fetchCandleChunk(figi, timeframe, fromMs, toMs);
        collected = [...chunk, ...collected];
      } catch (e) {
        console.error('[Tinkoff] fetchCandleChunk error:', e);
        break;
      }
      toMs = fromMs;
    }

    // Дедубликация + сортировка
    const seen = new Set<number>();
    return collected
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
      .sort((a, b) => a.time - b.time)
      .slice(-limit);
  }

  subscribeRealtime(
    symbol: string,
    timeframe: Timeframe,
    onCandleUpdate: (candle: Candle) => void,
  ): () => void {
    if (!this.token) return () => {};
    let active = true;
    const POLL_MS = timeframe === '1m' ? 3000 : 10000;

    const poll = async () => {
      const figi = await this.getFigi(symbol);
      if (!figi) return;
      while (active) {
        try {
          const stepMs = TF_STEP_MS[timeframe];
          const toMs   = Date.now();
          const fromMs = toMs - stepMs;
          const candles = await this.fetchCandleChunk(figi, timeframe, fromMs, toMs);
          if (candles.length > 0) {
            onCandleUpdate(candles[candles.length - 1]);
          }
        } catch (e) {
          console.error('[Tinkoff] realtime poll error:', e);
        }
        await new Promise(r => setTimeout(r, POLL_MS));
      }
    };
    poll();
    return () => { active = false; };
  }

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    if (!this.token) return [];
    try {
      const res = await axios.post(
        `${BASE}/tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument`,
        { query, apiTradeAvailableFlag: true },
        { headers: this.headers },
      );
      const instruments: any[] = res.data?.instruments ?? [];
      return instruments
        .filter(i => i.ticker && i.figi)
        .map(i => {
          // кэшируем сразу чтобы getHistoricalCandles не делал лишний запрос
          this.figiCache.set(i.ticker as string, i.figi as string);
          return {
            exchange:    'tinkoff',
            symbol:      i.ticker as string,
            description: (i.name ?? i.ticker) as string,
          };
        })
        .slice(0, 20);
    } catch (e) {
      console.error('[Tinkoff] searchSymbols error:', e);
      return [];
    }
  }
}
