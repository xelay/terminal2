import { Router } from 'express';
import { exchangeService } from '../exchanges/ExchangeService';

export const marketRouter = Router();

// Поиск символов
marketRouter.get('/search', async (req, res) => {
  const { exchange, query } = req.query;
  try {
    const adapter = exchangeService.getAdapter(exchange as string);
    const symbols = await adapter.searchSymbols(query as string);
    res.json({ symbols });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Исторические свечи
marketRouter.get('/history', async (req, res) => {
  const { exchange, symbol, tf, from, limit } = req.query;

  // Отключаем ETag/304 кэширование — данные всегда должны приходить свежими
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('ETag', '');

  try {
    const adapter = exchangeService.getAdapter(exchange as string);
    const candles = await adapter.getHistoricalCandles(
      symbol as string,
      tf as any,
      from ? Number(from) : undefined,
      limit ? Number(limit) : 500,
    );
    res.json({ candles });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
