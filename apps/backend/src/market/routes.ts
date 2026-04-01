import { Router } from 'express';
import { exchangeService } from '../exchanges/ExchangeService';

export const marketRouter = Router();

// Поиск символов — по всем биржам если exchange не указан
marketRouter.get('/search', async (req, res) => {
  const { exchange, query } = req.query;
  if (!query || !(query as string).trim()) {
    res.json({ symbols: [] });
    return;
  }
  try {
    if (exchange) {
      const adapter = exchangeService.getAdapter(exchange as string);
      const symbols = await adapter.searchSymbols(query as string);
      res.json({ symbols });
    } else {
      const symbols = await exchangeService.searchAll(query as string);
      res.json({ symbols });
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Исторические свечи
// from   = unix timestamp, начало диапазона (первоначальная загрузка)
// before = unix timestamp, верхняя граница — вернуть limit свечей ДО этого момента (пагинация)
marketRouter.get('/history', async (req, res) => {
  const { exchange, symbol, tf, from, before, limit } = req.query;

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('ETag', '');

  try {
    const adapter = exchangeService.getAdapter(exchange as string);
    const lim = limit ? Number(limit) : 500;

    let candles;
    if (before) {
      // Пагинация назад: адаптер должен вернуть свечи ДО before
      candles = await adapter.getHistoricalCandles(
        symbol as string,
        tf as any,
        Number(before),
        lim,
        true, // isPagination flag
      );
    } else {
      // Первоначальная загрузка: последние limit свечей
      candles = await adapter.getHistoricalCandles(
        symbol as string,
        tf as any,
        from ? Number(from) : undefined,
        lim,
      );
    }
    res.json({ candles });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
