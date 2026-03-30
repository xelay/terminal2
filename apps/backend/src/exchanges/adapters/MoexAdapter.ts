import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe, SymbolResult } from '../types';

const MOEX_INTERVALS: Record<string, number> = {
  '1m': 1, '10m': 10, '1h': 60, '1d': 24, '1w': 7, '1M': 31,
};

const TF_CONFIG: Record<Timeframe, { native: string; mult: number }> = {
  '1m':  { native: '1m',  mult: 1  },
  '5m':  { native: '1m',  mult: 5  },
  '15m': { native: '1m',  mult: 15 },
  '1h':  { native: '1h',  mult: 1  },
  '4h':  { native: '1h',  mult: 4  },
  '1d':  { native: '1d',  mult: 1  },
  '1w':  { native: '1w',  mult: 1  },
  '1M':  { native: '1M',  mult: 1  },
};

function aggregateCandles(candles: Candle[], mult: number): Candle[] {
  if (mult === 1) return candles;
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += mult) {
    const chunk = candles.slice(i, i + mult);
    if (!chunk.length) continue;
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

  private buildUrl(symbol: string, nativeInterval: string, from?: string, till?: string, start = 0): string {
    const interval = MOEX_INTERVALS[nativeInterval];
    let url =
      `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR` +
      `/securities/${encodeURIComponent(symbol)}/candles.json` +
      `?interval=${interval}&iss.meta=off&start=${start}`;
    if (from) url += `&from=${from}`;
    if (till) url += `&till=${till}`;
    return url;
  }

  private parseCandlesBlock(block: any): Candle[] {
    if (!block?.data?.length) return [];
    const columns: string[] = block.columns;
    const idx = (n: string) => columns.indexOf(n);
    const iOpen = idx('open'), iClose = idx('close'), iHigh = idx('high');
    const iLow = idx('low'), iVolume = idx('volume'), iBegin = idx('begin');
    return block.data
      .map((row: any[]) => ({
        time:   Math.floor(new Date(row[iBegin] as string).getTime() / 1000),
        open:   parseFloat(row[iOpen]),
        high:   parseFloat(row[iHigh]),
        low:    parseFloat(row[iLow]),
        close:  parseFloat(row[iClose]),
        volume: parseFloat(row[iVolume]),
      }))
      .filter((c: Candle) => !isNaN(c.time) && !isNaN(c.open));
  }

  private async fetchLastNative(symbol: string, nativeInterval: string, n: number, tillTime?: number): Promise<Candle[]> {
    const till = tillTime ? toDateStr(tillTime) : toDateStr(Math.floor(Date.now() / 1000) + 86400);
    const probeUrl = this.buildUrl(symbol, nativeInterval, undefined, till, 0);
    const probeRes = await axios.get(probeUrl);
    const cursor = probeRes.data?.candles?.cursor;
    let total: number = cursor?.data?.[0]?.[1] ?? 0;

    if (!total) {
      const firstBatch = this.parseCandlesBlock(probeRes.data?.candles);
      if (!firstBatch.length) return [];
      if (firstBatch.length < 500) return firstBatch.slice(-n);
      let all = [...firstBatch];
      let start = 500;
      while (true) {
        const url = this.buildUrl(symbol, nativeInterval, undefined, till, start);
        const res = await axios.get(url);
        const batch = this.parseCandlesBlock(res.data?.candles);
        if (!batch.length) break;
        all = [...all, ...batch];
        if (batch.length < 500) break;
        start += 500;
      }
      return all.slice(-n);
    }

    const startFrom = Math.max(0, total - n);
    let candles: Candle[] = [];
    let start = startFrom;
    while (true) {
      const url = this.buildUrl(symbol, nativeInterval, undefined, till, start);
      const res = await axios.get(url);
      const batch = this.parseCandlesBlock(res.data?.candles);
      if (!batch.length) break;
      candles = [...candles, ...batch];
      if (batch.length < 500) break;
      start += 500;
    }
    return candles;
  }

  private async fetchBeforeTime(symbol: string, nativeInterval: string, beforeTime: number, n: number): Promise<Candle[]> {
    const till = toDateStr(beforeTime);
    const probeUrl = this.buildUrl(symbol, nativeInterval, undefined, till, 0);
    const probeRes = await axios.get(probeUrl);
    const cursor = probeRes.data?.candles?.cursor;
    const total: number = cursor?.data?.[0]?.[1] ?? 0;

    if (!total) {
      const batch = this.parseCandlesBlock(probeRes.data?.candles);
      return batch.filter(c => c.time < beforeTime).slice(-n);
    }

    const startFrom = Math.max(0, total - n);
    let candles: Candle[] = [];
    let start = startFrom;
    while (true) {
      const url = this.buildUrl(symbol, nativeInterval, undefined, till, start);
      const res = await axios.get(url);
      const batch = this.parseCandlesBlock(res.data?.candles);
      if (!batch.length) break;
      candles = [...candles, ...batch];
      if (batch.length < 500) break;
      start += 500;
    }
    return candles.filter(c => c.time < beforeTime).slice(-n);
  }

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, fromTime?: number, limit = 500): Promise<Candle[]> {
    const { native, mult } = TF_CONFIG[timeframe];
    const nativeLimit = limit * mult;
    try {
      let candles: Candle[];
      if (fromTime) {
        candles = await this.fetchBeforeTime(symbol, native, fromTime, nativeLimit);
      } else {
        candles = await this.fetchLastNative(symbol, native, nativeLimit);
      }
      const seen = new Set<number>();
      candles = candles
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => a.time - b.time);
      return aggregateCandles(candles, mult).slice(-limit);
    } catch (e) {
      console.error('MOEX REST Error:', e);
      return [];
    }
  }

  subscribeRealtime(symbol: string, timeframe: Timeframe, onCandleUpdate: (candle: Candle) => void): () => void {
    let isActive = true;
    const pollLoop = async () => {
      while (isActive) {
        try {
          const candles = await this.fetchLastNative(symbol, TF_CONFIG[timeframe].native, TF_CONFIG[timeframe].mult * 2);
          if (candles.length > 0) {
            const agg = aggregateCandles(candles, TF_CONFIG[timeframe].mult);
            onCandleUpdate(agg[agg.length - 1]);
          }
        } catch (e) {
          console.error('MOEX poll error:', e);
        }
        await new Promise(res => setTimeout(res, 10000));
      }
    };
    pollLoop();
    return () => { isActive = false; };
  }

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    try {
      const url =
        `https://iss.moex.com/iss/securities.json` +
        `?q=${encodeURIComponent(query)}&iss.meta=off` +
        `&securities.columns=secid,shortname,name,is_traded,primary_boardid&limit=30`;
      const res = await axios.get(url);
      const block = res.data?.securities;
      if (!block) return [];
      const columns: string[] = block.columns;
      const data: any[][] = block.data;
      const iSecid     = columns.indexOf('secid');
      const iShortname = columns.indexOf('shortname');
      const iName      = columns.indexOf('name');
      const iTraded    = columns.indexOf('is_traded');
      const iBoard     = columns.indexOf('primary_boardid');
      return data
        .filter(row => row[iTraded] === 1 && ['TQBR', 'TQTF', 'TQIF'].includes(row[iBoard]))
        .map(row => ({
          exchange: 'moex',
          symbol:      row[iSecid]     as string,
          description: (row[iShortname] || row[iName] || row[iSecid]) as string,
        }))
        .filter(r => r.symbol)
        .slice(0, 20);
    } catch (e) {
      console.error('MOEX search error:', e);
      return [];
    }
  }
}
