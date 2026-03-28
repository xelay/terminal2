import axios from 'axios';
import { ExchangeAdapter, Candle, Timeframe } from '../types';

export class MoexAdapter implements ExchangeAdapter {
  public id = 'moex';
  private baseUrl = 'https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities';

  // MOEX ISS API intervals: 1=1m, 10=10m, 60=1h, 24=1d. (5m и 15m отсутствуют в стандартном REST candles API, берем 10m как замену, или 1m и аггрегируем)
  // Для простоты примера маппим 1 к 1, 5/15 к 10.
  private tfMap: Record<Timeframe, number> = {
    '1m': 1, '5m': 10, '15m': 10, 
    '1h': 60, '4h': 60, '1d': 24
  };

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, fromTime?: number, limit = 500): Promise<Candle[]> {
    const interval = this.tfMap[timeframe];
    let url = `${this.baseUrl}/${symbol}/candles.json?interval=${interval}&iss.meta=off`;
    
    if (fromTime) {
      const fromStr = new Date(fromTime * 1000).toISOString().split('T')[0]; // Формат YYYY-MM-DD
      url += `&from=${fromStr}`;
    }

    try {
      const response = await axios.get(url);
      const data = response.data.candles.data; // MOEX возвращает массив массивов
      
      // Индексы колонок: 0=open, 1=close, 2=high, 3=low, 4=value, 5=volume, 6=begin, 7=end
      // Внимание: индексы могут меняться, лучше маппить по response.data.candles.columns, но для краткости хардкодим.
      return data.map((row: any[]) => {
        const timeStr = row[6] as string; // '2023-10-01 10:00:00'
        return {
          time: Math.floor(new Date(timeStr).getTime() / 1000),
          open: parseFloat(row[0]),
          close: parseFloat(row[1]),
          high: parseFloat(row[2]),
          low: parseFloat(row[3]),
          volume: parseFloat(row[5]),
        };
      }).slice(-limit); // Отдаем последние limit свечей
    } catch (e) {
      console.error(`MOEX REST Error:`, e);
      return [];
    }
  }

  subscribeRealtime(symbol: string, timeframe: Timeframe, onCandleUpdate: (candle: Candle) => void): () => void {
    let isActive = true;
    
    const pollLoop = async () => {
      while (isActive) {
        // Берем последнюю 1 свечу
        const candles = await this.getHistoricalCandles(symbol, timeframe, undefined, 1);
        if (candles && candles.length > 0) {
          onCandleUpdate(candles[candles.length - 1]);
        }
        // Умный поллинг: запрашиваем раз в 3 секунды
        await new Promise(res => setTimeout(res, 3000));
      }
    };

    pollLoop();

    return () => {
      isActive = false;
    };
  }

  async searchSymbols(query: string): Promise<string[]> {
    try {
      // Поиск тикеров на MOEX
      const url = `https://iss.moex.com/iss/securities.json?q=${query}&iss.meta=off`;
      const res = await axios.get(url);
      const data = res.data.securities.data;
      // Индекс 1 - secid (тикер)
      return data.map((row: any[]) => row[1]).slice(0, 20);
    } catch (e) {
      return [];
    }
  }
}
