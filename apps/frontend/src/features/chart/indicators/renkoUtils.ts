export type PriceSource = 'close' | 'highlow';

export interface RenkoBlock {
  direction: 'up' | 'down';
  priceFrom: number;
  priceTo: number;
  timeStart: number;
  timeEnd: number;
  isPending?: boolean;
}

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG LOGGING
// Установи window.__RENKO_DEBUG__ = true в консоли браузера для включения логов.
// Пример: window.__RENKO_DEBUG__ = true
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window { __RENKO_DEBUG__?: boolean; }
}

const RENKO_DEBUG = () =>
  typeof window !== 'undefined' && !!window.__RENKO_DEBUG__;

function dbg(...args: unknown[]) {
  if (RENKO_DEBUG()) console.log('[Renko]', ...args);
}

/** Считаем ATR-50 по всем свечам */
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

export function smartRound(value: number, refPrice: number): number {
  if (refPrice > 100) return Math.round(value);
  if (refPrice > 10)  return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Основной алгоритм построения блоков Renko.
 * Логирование включается через: window.__RENKO_DEBUG__ = true
 */
export function buildRenkoBlocks(
  candles: Candle[],
  blockSize: number,
  source: PriceSource,
): RenkoBlock[] {
  if (candles.length === 0 || blockSize <= 0) {
    dbg('buildRenkoBlocks: пустые свечи или blockSize <= 0, выход');
    return [];
  }

  const debug = RENKO_DEBUG();

  const blocks: RenkoBlock[] = [];

  const firstCandle = candles[0];
  let currentLevel = source === 'close'
    ? firstCandle.close
    : (firstCandle.high + firstCandle.low) / 2;

  const startLevelRaw = currentLevel;
  currentLevel = Math.floor(currentLevel / blockSize) * blockSize;

  dbg(
    `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧱 buildRenkoBlocks START
   source      : ${source}
   blockSize   : ${blockSize}
   candles     : ${candles.length} (от ${new Date(candles[0].time * 1000).toLocaleDateString()} до ${new Date(candles[candles.length - 1].time * 1000).toLocaleDateString()})
   startPrice  : ${startLevelRaw} → выровнен по сетке → ${currentLevel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  let blockStartTime = firstCandle.time;
  let lastDirection: 'up' | 'down' | null = null;
  let candleIdx = 0;

  for (const candle of candles) {
    candleIdx++;

    if (source === 'close') {
      const price = candle.close;
      const prevLevel = currentLevel;
      let moved = false;

      while (price >= currentLevel + blockSize) {
        blocks.push({
          direction: 'up',
          priceFrom: currentLevel,
          priceTo:   currentLevel + blockSize,
          timeStart: blockStartTime,
          timeEnd:   candle.time,
        });
        if (debug) {
          console.log(
            `[Renko] 🟢 UP   блок #${blocks.length}`,
            `${currentLevel} → ${currentLevel + blockSize}`,
            `| свеча #${candleIdx} close=${price}`,
            `| дата: ${new Date(candle.time * 1000).toLocaleDateString()}`,
          );
        }
        currentLevel += blockSize;
        blockStartTime = candle.time;
        lastDirection = 'up';
        moved = true;
      }

      while (price <= currentLevel - blockSize) {
        blocks.push({
          direction: 'down',
          priceFrom: currentLevel - blockSize,
          priceTo:   currentLevel,
          timeStart: blockStartTime,
          timeEnd:   candle.time,
        });
        if (debug) {
          console.log(
            `[Renko] 🔴 DOWN блок #${blocks.length}`,
            `${currentLevel - blockSize} → ${currentLevel}`,
            `| свеча #${candleIdx} close=${price}`,
            `| дата: ${new Date(candle.time * 1000).toLocaleDateString()}`,
          );
        }
        currentLevel -= blockSize;
        blockStartTime = candle.time;
        lastDirection = 'down';
        moved = true;
      }

      if (!moved && debug && candleIdx <= 10) {
        console.log(
          `[Renko] ⏳ нет блока свеча #${candleIdx}`,
          `close=${price} | level=${currentLevel}`,
          `| до UP: +${(currentLevel + blockSize - price).toFixed(2)}`,
          `| до DOWN: -${(price - (currentLevel - blockSize)).toFixed(2)}`,
        );
      }

    } else {
      // highlow
      if (lastDirection !== 'down' && candle.high >= currentLevel + blockSize) {
        let moved = false;
        while (candle.high >= currentLevel + blockSize) {
          blocks.push({
            direction: 'up',
            priceFrom: currentLevel,
            priceTo:   currentLevel + blockSize,
            timeStart: blockStartTime,
            timeEnd:   candle.time,
          });
          if (debug) {
            console.log(
              `[Renko] 🟢 UP(hl)  блок #${blocks.length}`,
              `${currentLevel} → ${currentLevel + blockSize}`,
              `| high=${candle.high}`,
              `| дата: ${new Date(candle.time * 1000).toLocaleDateString()}`,
            );
          }
          currentLevel += blockSize;
          blockStartTime = candle.time;
          lastDirection = 'up';
          moved = true;
        }
        // Проверяем: если в этой же свече low пробивает вниз — логируем конфликт
        if (debug && candle.low <= currentLevel - blockSize) {
          console.warn(
            `[Renko] ⚠️ КОНФЛИКТ свеча #${candleIdx}`,
            `high=${candle.high} пробил вверх, но low=${candle.low} пробивает вниз!`,
            `currentLevel=${currentLevel}`,
            `| дата: ${new Date(candle.time * 1000).toLocaleDateString()}`,
            '→ down-проверка пропускается (приоритет up)',
          );
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
          if (debug) {
            console.log(
              `[Renko] 🔴 DOWN(hl) блок #${blocks.length}`,
              `${currentLevel - blockSize} → ${currentLevel}`,
              `| low=${candle.low}`,
              `| дата: ${new Date(candle.time * 1000).toLocaleDateString()}`,
            );
          }
          currentLevel -= blockSize;
          blockStartTime = candle.time;
          lastDirection = 'down';
        }
      }
    }
  }

  // ─── Pending-блок ───────────────────────────────────────────────────────────
  let pendingBlock: RenkoBlock | null = null;

  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const lastPrice = source === 'close'
      ? lastCandle.close
      : (lastCandle.high + lastCandle.low) / 2;

    const pendingDir: 'up' | 'down' = lastPrice >= currentLevel ? 'up' : 'down';

    let pendingFrom: number;
    let pendingTo: number;

    if (pendingDir === 'up') {
      pendingFrom = currentLevel;
      pendingTo   = Math.min(lastPrice, currentLevel + blockSize);
    } else {
      pendingFrom = Math.max(lastPrice, currentLevel - blockSize);
      pendingTo   = currentLevel;
    }

    if (Math.abs(pendingTo - pendingFrom) > 0.001) {
      pendingBlock = {
        direction: pendingDir,
        priceFrom: pendingFrom,
        priceTo:   pendingTo,
        timeStart: blockStartTime,
        timeEnd:   lastCandle.time,
        isPending: true,
      };
      blocks.push(pendingBlock);
    }
  }

  // ─── Итоговый дамп ──────────────────────────────────────────────────────────
  if (debug) {
    console.groupCollapsed(`[Renko] 📋 ИТОГ: ${blocks.length} блоков (включая pending)`);
    console.log('blockSize:', blockSize, '| source:', source, '| finalLevel:', currentLevel);
    console.log('Pending-блок:', pendingBlock
      ? `${pendingBlock.direction.toUpperCase()} ${pendingBlock.priceFrom} → ${pendingBlock.priceTo}`
      : 'нет');
    console.log('');
    console.log('Последние 20 блоков:');
    const tail = blocks.slice(-20);
    console.table(
      tail.map((b, i) => ({
        '№': blocks.length - tail.length + i + 1,
        dir: b.direction,
        from: b.priceFrom,
        to: b.priceTo,
        timeStart: new Date(b.timeStart * 1000).toLocaleDateString(),
        timeEnd: new Date(b.timeEnd * 1000).toLocaleDateString(),
        pending: b.isPending ? '✓' : '',
      }))
    );

    // Проверка: ищем блоки с одинаковым диапазоном цен (потенциальные дубли)
    const seen = new Map<string, number>();
    const duplicates: unknown[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const key = `${blocks[i].priceFrom}-${blocks[i].priceTo}`;
      if (seen.has(key)) {
        duplicates.push({
          '№': i + 1,
          dir: blocks[i].direction,
          range: key,
          timeStart: new Date(blocks[i].timeStart * 1000).toLocaleDateString(),
          timeEnd: new Date(blocks[i].timeEnd * 1000).toLocaleDateString(),
          'дубль блока №': seen.get(key),
        });
      } else {
        seen.set(key, i + 1);
      }
    }
    if (duplicates.length > 0) {
      console.warn(`[Renko] ⚠️ Найдено ${duplicates.length} блоков с повторяющимися ценовыми диапазонами (возможные дубли):`);
      console.table(duplicates);
    } else {
      console.log('[Renko] ✅ Дублей ценовых диапазонов не найдено');
    }

    // Проверка: ищем блоки где timeEnd < timeStart
    const badTime = blocks.filter(b => b.timeEnd < b.timeStart);
    if (badTime.length > 0) {
      console.warn('[Renko] ⚠️ Блоки с timeEnd < timeStart:', badTime.length);
      console.table(badTime);
    }

    // Проверка: ищем смену направления (разворот)
    let reversals = 0;
    for (let i = 1; i < blocks.length; i++) {
      if (!blocks[i].isPending && blocks[i].direction !== blocks[i - 1].direction) reversals++;
    }
    console.log(`[Renko] 🔄 Разворотов направления: ${reversals}`);

    console.groupEnd();
  }

  dbg(`buildRenkoBlocks END: ${blocks.length} блоков, finalLevel=${currentLevel}`);

  return blocks;
}
