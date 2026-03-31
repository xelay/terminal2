import ccxt, { pro } from 'ccxt';
import { ExchangeAdapter, Candle, Timeframe, SymbolResult } from '../types';

export class BybitAdapter implements ExchangeAdapter {
  public id = 'bybit';
  private client: pro.bybit;
  private activeSubscriptions = new Map<string, boolean>();

  // loadMarkets вызывается ОДИН РАЗ — результат кэшируется навсегда
  private marketsPromise: Promise<void> | null = null;
  private marketsLoaded = false;

  // throttle логов — не чаще 1 раза в 60 сек на символ
  private lastErrorLog = new Map<string, number>();

  private tfMap: Record<Timeframe, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m',
    '1h': '1h', '4h': '4h', '1d': '1d',
    '1w': '1w', '1M': '1M',
  };

  constructor() {
    this.client = new pro.bybit({ enableRateLimit: true, newUpdates: true });
    // Грузим markets сразу при старте — не ждём первого запроса
    this.ensureMarkets();
  }

  private ensureMarkets(): Promise<void> {
    if (this.marketsLoaded) return Promise.resolve();
    if (this.marketsPromise) return this.marketsPromise;
    this.marketsPromise = this.client.loadMarkets()
      .then(() => { this.marketsLoaded = true; })
      .catch((e) => {
        console.warn('[Bybit] loadMarkets failed, will retry on next search:', e.message);
        // Сбрасываем промис чтобы следующий вызов попробовал снова
        this.marketsPromise = null;
      });
    return this.marketsPromise;
  }

  private logError(symbol: string, e: any) {
    const now = Date.now();
    const last = this.lastErrorLog.get(symbol) ?? 0;
    if (now - last > 60_000) {
      console.warn(`[Bybit] WS error [${symbol}] (throttled, once/min):`, (e as Error).message);
      this.lastErrorLog.set(symbol, now);
    }
  }

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, fromTime?: number, limit = 500): Promise<Candle[]> {
    const since = fromTime ? fromTime * 1000 : undefined;
    const ohlcv = await this.client.fetchOHLCV(symbol, this.tfMap[timeframe], since, limit);
    return ohlcv.map((c: any) => ({
      time: Math.floor((c[0] as number) / 1000),
      open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
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
              open: latest[1], high: latest[2], low: latest[3], close: latest[4], volume: latest[5],
            });
          }
        } catch (e) {
          this.logError(symbol, e);
          await new Promise(res => setTimeout(res, 10_000));
        }
      }
    };

    watchLoop();
    return () => { this.activeSubscriptions.set(subKey, false); };
  }

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    // Ждём загрузки markets (если ещё не загружены)
    await this.ensureMarkets();

    const markets = this.client.markets;
    if (!markets) return [];

    const upperQuery = query.toUpperCase();
    return Object.entries(markets)
      .filter(([sym]) => sym.includes(upperQuery))
      .slice(0, 20)
      .map(([sym, market]: [string, any]) => ({
        exchange: 'bybit',
        symbol: sym,
        description: market?.name ?? market?.base ?? sym,
      }));
  }
}
