import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe } from '../types';

export class MoexAdapter implements ExchangeAdapter {
  public id = 'moex';

  // MOEX ISS intervals: 1=1m, 10=10m, 60=1h, 24=1d, 7=1w, 31=1M
  private tfMap: Record<Timeframe, number> = {
    '1m': 1, '5m': 10, '15m': 10,
    '1h': 60, '4h': 60, '1d': 24,
    '1w': 7, '1M': 31,
  };

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, fromTime?: number, limit = 500): Promise<Candle[]> {
    const interval = this.tfMap[timeframe];
    let url =
      `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR` +
      `/securities/${encodeURIComponent(symbol)}/candles.json?interval=${interval}&iss.meta=off`;

    if (fromTime) {
      const fromStr = new Date(fromTime * 1000).toISOString().split('T')[0];
      url += `&from=${fromStr}`;
    }

    try {
      const response = await axios.get(url);
      const block = response.data?.candles;
      if (!block) return [];

      const columns: string[] = block.columns;
      const data: any[][] = block.data;
      if (!data || data.length === 0) return [];

      const idx = (name: string) => columns.indexOf(name);
      const iOpen = idx('open'), iClose = idx('close'), iHigh = idx('high');
      const iLow  = idx('low'),  iVolume = idx('volume'), iBegin = idx('begin');

      return data
        .map((row) => ({
          time: Math.floor(new Date(row[iBegin] as string).getTime() / 1000),
          open: parseFloat(row[iOpen]),
          high: parseFloat(row[iHigh]),
          low:  parseFloat(row[iLow]),
          close: parseFloat(row[iClose]),
          volume: parseFloat(row[iVolume]),
        }))
        .filter((c) => !isNaN(c.time) && !isNaN(c.open))
        .slice(-limit);
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
          const candles = await this.getHistoricalCandles(symbol, timeframe, undefined, 2);
          if (candles.length > 0) onCandleUpdate(candles[candles.length - 1]);
        } catch (e) {
          console.error('MOEX poll error:', e);
        }
        await new Promise(res => setTimeout(res, 5000));
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
        .filter(row => row[iTraded] === 1 && ['TQBR','TQTF','TQIF'].includes(row[iBoard]))
        .map(row => row[iSecid] as string)
        .filter(Boolean)
        .slice(0, 20);
    } catch (e) {
      console.error('MOEX search error:', e);
      return [];
    }
  }
}
