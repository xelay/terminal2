import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe } from '../types';

// MOEX ISS native intervals
const MOEX_INTERVALS: Record<string, number> = {
  '1m': 1, '10m': 10, '1h': 60, '1d': 24, '1w': 7, '1M': 31,
};

// Для каждого таймфрейма: нативный интервал + множитель агрегации
const TF_CONFIG: Record<Timeframe, { native: string; mult: number }> = {
  '1m':  { native: '1m',  mult: 1  },
  '5m':  { native: '1m',  mult: 5  },  // агрегируем 5 баров по 1м
  '15m': { native: '10m', mult: 2  },  // ближайшее — 10м×2 ≈ 20м, но честнее 1м×15
  '1h':  { native: '1h',  mult: 1  },
  '4h':  { native: '1h',  mult: 4  },  // агрегируем 4 бара по 1ч
  '1d':  { native: '1d',  mult: 1  },
  '1w':  { native: '1w',  mult: 1  },
  '1M':  { native: '1M',  mult: 1  },
};

// Секунды нативного интервала (для вычисления границ при агрегации)
const NATIVE_SECONDS: Record<string, number> = {
  '1m': 60, '10m': 600, '1h': 3600, '1d': 86400, '1w': 604800, '1M': 2592000,
};

function aggregateCandles(candles: Candle[], mult: number): Candle[] {
  if (mult === 1) return candles;
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += mult) {
    const chunk = candles.slice(i, i + mult);
    if (chunk.length === 0) continue;
    result.push({
      time:   chunk[0].time,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(c => c.high)),
      low:    Math.min(...chunk.map(c => c.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return result;
}

function toDateStr(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0];
}

export class MoexAdapter implements ExchangeAdapter {
  public id = 'moex';

  private async fetchNativeCandles(
    symbol: string,
    nativeInterval: string,
    fromTime?: number,
    tillTime?: number,
    start = 0,
  ): Promise<Candle[]> {
    const interval = MOEX_INTERVALS[nativeInterval];
    let url =
      `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR` +
      `/securities/${encodeURIComponent(symbol)}/candles.json` +
      `?interval=${interval}&iss.meta=off&start=${start}`;

    if (fromTime) url += `&from=${toDateStr(fromTime)}`;
    if (tillTime) url += `&till=${toDateStr(tillTime)}`;

    const response = await axios.get(url);
    const block = response.data?.candles;
    if (!block || !block.data?.length) return [];

    const columns: string[] = block.columns;
    const data: any[][] = block.data;
    const idx = (name: string) => columns.indexOf(name);
    const iOpen = idx('open'), iClose = idx('close'), iHigh = idx('high');
    const iLow = idx('low'), iVolume = idx('volume'), iBegin = idx('begin');

    return data
      .map(row => ({
        time:   Math.floor(new Date(row[iBegin] as string).getTime() / 1000),
        open:   parseFloat(row[iOpen]),
        high:   parseFloat(row[iHigh]),
        low:    parseFloat(row[iLow]),
        close:  parseFloat(row[iClose]),
        volume: parseFloat(row[iVolume]),
      }))
      .filter(c => !isNaN(c.time) && !isNaN(c.open));
  }

  async getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    fromTime?: number,
    limit = 500,
  ): Promise<Candle[]> {
    const { native, mult } = TF_CONFIG[timeframe];
    // Нам нужно limit результирующих агрегированных баров,
    // значит нативных нужно limit*mult
    const nativeLimit = limit * mult;

    try {
      let candles: Candle[] = [];

      if (fromTime) {
        // Подгрузка истории назад: берём от fromTime
        let start = 0;
        while (candles.length < nativeLimit) {
          const batch = await this.fetchNativeCandles(symbol, native, undefined, fromTime, start);
          if (!batch.length) break;
          candles = [...batch, ...candles];
          if (batch.length < 500) break;
          start += 500;
        }
      } else {
        // Первичная загрузка: берём последние данные через till=завтра
        const tomorrow = Math.floor(Date.now() / 1000) + 86400;
        // MOEX отдаёт max 500 баров за запрос, грузим несколько страниц назад
        const pages = Math.ceil(nativeLimit / 500);
        for (let p = 0; p < pages; p++) {
          const batch = await this.fetchNativeCandles(symbol, native, undefined, tomorrow, p * 500);
          if (!batch.length) break;
          candles = [...batch, ...candles];
        }
      }

      // Убираем дубли и сортируем
      const seen = new Set<number>();
      candles = candles
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => a.time - b.time);

      // Агрегируем если нужно
      const aggregated = aggregateCandles(candles, mult);

      // Возвращаем последние limit баров
      return aggregated.slice(-limit);
    } catch (e) {
      console.error('MOEX REST Error:', e);
      return [];
    }
  }

  subscribeRealtime(
    symbol: string,
    timeframe: Timeframe,
    onCandleUpdate: (candle: Candle) => void,
  ): () => void {
    let isActive = true;
    const pollLoop = async () => {
      while (isActive) {
        try {
          const candles = await this.getHistoricalCandles(symbol, timeframe, undefined, 2);
          if (candles.length > 0) onCandleUpdate(candles[candles.length - 1]);
        } catch (e) {
          console.error('MOEX poll error:', e);
        }
        await new Promise(res => setTimeout(res, 10000));
      }
    };
    pollLoop();
    return () => { isActive = false; };
  }

  async searchSymbols(query: string): Promise<string[]> {
    try {
      const url =
        `https://iss.moex.com/iss/securities.json` +
        `?q=${encodeURIComponent(query)}&iss.meta=off` +
        `&securities.columns=secid,shortname,is_traded,primary_boardid&limit=30`;
      const res = await axios.get(url);
      const block = res.data?.securities;
      if (!block) return [];
      const columns: string[] = block.columns;
      const data: any[][] = block.data;
      const iSecid  = columns.indexOf('secid');
      const iTraded = columns.indexOf('is_traded');
      const iBoard  = columns.indexOf('primary_boardid');
      return data
        .filter(row => row[iTraded] === 1 && ['TQBR', 'TQTF', 'TQIF'].includes(row[iBoard]))
        .map(row => row[iSecid] as string)
        .filter(Boolean)
        .slice(0, 20);
    } catch (e) {
      console.error('MOEX search error:', e);
      return [];
    }
  }
}
