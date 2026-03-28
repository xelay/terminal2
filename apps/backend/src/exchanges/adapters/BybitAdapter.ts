import ccxt, { pro } from 'ccxt';
import { ExchangeAdapter, Candle, Timeframe } from '../types';

export class BybitAdapter implements ExchangeAdapter {
  public id = 'bybit';
  private client: pro.bybit;
  private activeSubscriptions = new Map<string, boolean>();

  // Маппинг наших TF в форматы CCXT
  private tfMap: Record<Timeframe, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m',
    '1h': '1h', '4h': '4h', '1d': '1d'
  };

  constructor() {
    this.client = new pro.bybit({
      enableRateLimit: true,
      newUpdates: true, // Генерировать события только при новых данных
    });
  }

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, fromTime?: number, limit = 500): Promise<Candle[]> {
    const since = fromTime ? fromTime * 1000 : undefined; // CCXT ждет миллисекунды
    const ohlcv = await this.client.fetchOHLCV(symbol, this.tfMap[timeframe], since, limit);
    
    return ohlcv.map((candle: any) => ({
      time: Math.floor((candle[0] as number) / 1000), // Переводим в секунды для Lightweight Charts
      open: candle[1] as number,
      high: candle[2] as number,
      low: candle[3] as number,
      close: candle[4] as number,
      volume: candle[5] as number,
    }));
  }

  subscribeRealtime(symbol: string, timeframe: Timeframe, onCandleUpdate: (candle: Candle) => void): () => void {
    const ccxtTf = this.tfMap[timeframe];
    const subKey = `${symbol}:${ccxtTf}`;
    this.activeSubscriptions.set(subKey, true);

    const watchLoop = async () => {
      while (this.activeSubscriptions.get(subKey)) {
        try {
          const ohlcv = await this.client.watchOHLCV(symbol, ccxtTf);
          if (ohlcv && ohlcv.length > 0) {
            const latest = ohlcv[ohlcv.length - 1];
            onCandleUpdate({
              time: Math.floor((latest[0] as number) / 1000),
              open: latest[1] as number,
              high: latest[2] as number,
              low: latest[3] as number,
              close: latest[4] as number,
              volume: latest[5] as number,
            });
          }
        } catch (e) {
          console.error(`Bybit WS Error [${symbol}]:`, e);
          // Делаем паузу перед реконнектом
          await new Promise(res => setTimeout(res, 5000)); 
        }
      }
    };

    watchLoop();

    // Возвращаем функцию отписки
    return () => {
      this.activeSubscriptions.set(subKey, false);
      // В ccxt.pro нет явной отписки watchOHLCV, остановка цикла прекратит обработку
    };
  }

  async searchSymbols(query: string): Promise<string[]> {
    if (!this.client.markets) await this.client.loadMarkets();
    const upperQuery = query.toUpperCase();
    return Object.keys(this.client.markets || {})
      .filter(sym => sym.includes(upperQuery))
      .slice(0, 20);
  }
}
