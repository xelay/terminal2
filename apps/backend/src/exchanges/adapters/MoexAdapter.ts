import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe } from '../types';

export class MoexAdapter implements ExchangeAdapter {
  public id = 'moex';

  // MOEX ISS intervals: 1=1m, 10=10m, 60=1h, 24=1d
  private tfMap: Record<Timeframe, number> = {
    '1m': 1,
    '5m': 10,
    '15m': 10,
    '1h': 60,
    '4h': 60,
    '1d': 24,
  };

  async getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    fromTime?: number,
    limit = 500,
  ): Promise<Candle[]> {
    const interval = this.tfMap[timeframe];
    // Правильный URL для свечей
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

      // Динамически находим индексы по названию колонки
      const idx = (name: string) => columns.indexOf(name);
      const iOpen   = idx('open');
      const iClose  = idx('close');
      const iHigh   = idx('high');
      const iLow    = idx('low');
      const iVolume = idx('volume');
      const iBegin  = idx('begin');

      const candles: Candle[] = data
        .map((row) => {
          const timeStr = row[iBegin] as string; // '2024-01-15 10:00:00'
          return {
            time: Math.floor(new Date(timeStr).getTime() / 1000),
            open: parseFloat(row[iOpen]),
            high: parseFloat(row[iHigh]),
            low: parseFloat(row[iLow]),
            close: parseFloat(row[iClose]),
            volume: parseFloat(row[iVolume]),
          };
        })
        .filter((c) => !isNaN(c.time) && !isNaN(c.open));

      // MOEX отдаёт данные с начала, берём последние limit
      return candles.slice(-limit);
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
          if (candles.length > 0) {
            onCandleUpdate(candles[candles.length - 1]);
          }
        } catch (e) {
          console.error('MOEX poll error:', e);
        }
        await new Promise((res) => setTimeout(res, 5000));
      }
    };

    pollLoop();
    return () => { isActive = false; };
  }

  async searchSymbols(query: string): Promise<string[]> {
    try {
      // Ищем только акции на TQBR (основной рынок акций)
      const url =
        `https://iss.moex.com/iss/securities.json` +
        `?q=${encodeURIComponent(query)}` +
        `&iss.meta=off` +
        `&securities.columns=secid,shortname,is_traded,primary_boardid` +
        `&limit=30`;

      const res = await axios.get(url);
      const block = res.data?.securities;
      if (!block) return [];

      const columns: string[] = block.columns;
      const data: any[][] = block.data;
      if (!data) return [];

      const iSecid   = columns.indexOf('secid');
      const iTraded  = columns.indexOf('is_traded');
      const iBoard   = columns.indexOf('primary_boardid');

      return data
        .filter((row) =>
          // Только торгуемые акции на TQBR или TQTF
          row[iTraded] === 1 &&
          (row[iBoard] === 'TQBR' || row[iBoard] === 'TQTF' || row[iBoard] === 'TQIF')
        )
        .map((row) => row[iSecid] as string)
        .filter(Boolean)
        .slice(0, 20);
    } catch (e) {
      console.error('MOEX search error:', e);
      return [];
    }
  }
}
