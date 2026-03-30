export type PriceSource = 'close' | 'highlow';

export interface RenkoBlock {
  direction: 'up' | 'down';
  priceFrom: number;  // нижняя граница блока
  priceTo: number;    // верхняя граница блока
  timeStart: number;  // unix-time начала блока
  timeEnd: number;    // unix-time конца блока (включительно)
}

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Считаем ATR-50 по всем свечам (или по последним 50 если их меньше) */
export function calcATR(candles: Candle[], period = 50): number {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-Math.max(period + 1, candles.length));
  let atrSum = 0;
  let count = 0;
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const prev = slice[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low  - prev.close),
    );
    atrSum += tr;
    count++;
  }
  return count > 0 ? atrSum / count : 0;
}

/** Умное округление под масштаб цены */
export function smartRound(value: number, refPrice: number): number {
  if (refPrice > 100) return Math.round(value);
  if (refPrice > 10)  return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/** Основной алгоритм построения блоков Renko по всей истории */
export function buildRenkoBlocks(
  candles: Candle[],
  blockSize: number,
  source: PriceSource,
): RenkoBlock[] {
  if (candles.length === 0 || blockSize <= 0) return [];

  const blocks: RenkoBlock[] = [];

  // Стартовая цена — close или mid первой свечи
  const firstCandle = candles[0];
  let currentLevel = source === 'close'
    ? firstCandle.close
    : (firstCandle.high + firstCandle.low) / 2;

  // Выравниваем currentLevel по сетке blockSize
  currentLevel = Math.floor(currentLevel / blockSize) * blockSize;

  let blockStartTime = firstCandle.time;

  for (const candle of candles) {
    const priceHigh = source === 'close' ? candle.close : candle.high;
    const priceLow  = source === 'close' ? candle.close : candle.low;

    // Проверяем блоки вверх
    while (priceHigh >= currentLevel + blockSize) {
      blocks.push({
        direction: 'up',
        priceFrom: currentLevel,
        priceTo:   currentLevel + blockSize,
        timeStart: blockStartTime,
        timeEnd:   candle.time,
      });
      currentLevel += blockSize;
      blockStartTime = candle.time;
    }

    // Проверяем блоки вниз
    while (priceLow <= currentLevel - blockSize) {
      blocks.push({
        direction: 'down',
        priceFrom: currentLevel - blockSize,
        priceTo:   currentLevel,
        timeStart: blockStartTime,
        timeEnd:   candle.time,
      });
      currentLevel -= blockSize;
      blockStartTime = candle.time;
    }
  }

  // Последний незакрытый блок — тянем до последней свечи
  // (не добавляем как полноценный блок, просто растягиваем последний)
  if (blocks.length > 0) {
    blocks[blocks.length - 1].timeEnd = candles[candles.length - 1].time;
  }

  return blocks;
}
