export type PriceSource = 'close' | 'highlow';

export interface RenkoBlock {
  direction: 'up' | 'down';
  priceFrom: number;  // нижняя граница блока
  priceTo: number;    // верхняя граница блока
  timeStart: number;  // unix-time начала блока
  timeEnd: number;    // unix-time конца блока (включительно)
  isPending?: boolean; // true = текущий незакрытый блок
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

/**
 * Основной алгоритм построения блоков Renko.
 *
 * Фиксы:
 * 1. Закрытый блок не растягивается до конца графика — timeEnd фиксируется на свече закрытия.
 * 2. Добавляется полупрозрачный «пендинг»-блок — показывает текущее движение цены до следующего уровня.
 * 3. При source='highlow': сначала проверяем только одно направление (по последнему направлению движения).
 */
export function buildRenkoBlocks(
  candles: Candle[],
  blockSize: number,
  source: PriceSource,
): RenkoBlock[] {
  if (candles.length === 0 || blockSize <= 0) return [];

  const blocks: RenkoBlock[] = [];

  const firstCandle = candles[0];
  let currentLevel = source === 'close'
    ? firstCandle.close
    : (firstCandle.high + firstCandle.low) / 2;

  // Выравниваем по сетке
  currentLevel = Math.floor(currentLevel / blockSize) * blockSize;

  let blockStartTime = firstCandle.time;

  // Текущее направление (для highlow режима: помним последнее движение чтобы не проверять оба направления внутри одной свечи)
  let lastDirection: 'up' | 'down' | null = null;

  for (const candle of candles) {
    if (source === 'close') {
      const price = candle.close;
      // Вверх
      while (price >= currentLevel + blockSize) {
        blocks.push({
          direction: 'up',
          priceFrom: currentLevel,
          priceTo:   currentLevel + blockSize,
          timeStart: blockStartTime,
          timeEnd:   candle.time,
        });
        currentLevel += blockSize;
        blockStartTime = candle.time;
        lastDirection = 'up';
      }
      // Вниз
      while (price <= currentLevel - blockSize) {
        blocks.push({
          direction: 'down',
          priceFrom: currentLevel - blockSize,
          priceTo:   currentLevel,
          timeStart: blockStartTime,
          timeEnd:   candle.time,
        });
        currentLevel -= blockSize;
        blockStartTime = candle.time;
        lastDirection = 'down';
      }
    } else {
      // highlow: сначала проверяем только одно направление чтобы избежать конфликта high/low в одной свече
      // Приоритет up: если последнее движение было up или неустановлено
      if (lastDirection !== 'down' && candle.high >= currentLevel + blockSize) {
        while (candle.high >= currentLevel + blockSize) {
          blocks.push({
            direction: 'up',
            priceFrom: currentLevel,
            priceTo:   currentLevel + blockSize,
            timeStart: blockStartTime,
            timeEnd:   candle.time,
          });
          currentLevel += blockSize;
          blockStartTime = candle.time;
          lastDirection = 'up';
        }
      } else if (candle.low <= currentLevel - blockSize) {
        while (candle.low <= currentLevel - blockSize) {
          blocks.push({
            direction: 'down',
            priceFrom: currentLevel - blockSize,
            priceTo:   currentLevel,
            timeStart: blockStartTime,
            timeEnd:   candle.time,
          });
          currentLevel -= blockSize;
          blockStartTime = candle.time;
          lastDirection = 'down';
        }
      }
    }
  }

  // Пендинг-блок: показывает текущую позицию цены относительно следующего уровня
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const lastPrice = source === 'close'
      ? lastCandle.close
      : (lastCandle.high + lastCandle.low) / 2;

    // Определяем направление пендинг-блока по позиции цены
    const pendingDir: 'up' | 'down' = lastPrice >= currentLevel ? 'up' : 'down';

    let pendingFrom: number;
    let pendingTo: number;

    if (pendingDir === 'up') {
      pendingFrom = currentLevel;
      // Тянем до текущей цены, но не выше следующего уровня
      pendingTo = Math.min(lastPrice, currentLevel + blockSize);
    } else {
      // Цена ниже currentLevel — блок смотрит вниз
      pendingFrom = Math.max(lastPrice, currentLevel - blockSize);
      pendingTo   = currentLevel;
    }

    // Не добавляем пендинг если он пустой (pending == 0 высоты)
    if (Math.abs(pendingTo - pendingFrom) > 0.001) {
      blocks.push({
        direction: pendingDir,
        priceFrom: pendingFrom,
        priceTo:   pendingTo,
        timeStart: blockStartTime,
        timeEnd:   lastCandle.time,
        isPending: true,
      });
    }
  }

  return blocks;
}
