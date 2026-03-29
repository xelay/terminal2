import React, { useState } from 'react';
import { ChartView } from '../features/chart/ChartView';
import { IndicatorsModal } from '../features/chart/indicators/IndicatorsModal';
import { SymbolSearchModal } from '../features/modals/SymbolSearchModal';
import { CanvasOverlay } from '../features/drawings/CanvasOverlay';
import { ChartRefsContext } from '../features/chart/ChartRefsContext';
import { useWorkspaceStore } from '../store/workspace';
import { Timeframe } from '../store/workspace';
import '../styles/globals.css';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe } = useWorkspaceStore();
  const [isSearchOpen, setIsSearchOpen]         = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isDrawingMode, setIsDrawingMode]       = useState(false);
  const [chartRefs, setChartRefs] = useState<{ chart: any; series: any } | null>(null);

  return (
    <ChartRefsContext.Provider value={{ chartRefs, setChartRefs }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#131722', color: 'white' }}>

        <header style={{ height: '50px', borderBottom: '1px solid #2b2b43', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px', flexShrink: 0 }}>
          <button
            onClick={() => setIsSearchOpen(true)}
            style={{ background: '#2b2b43', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
          >
            {exchange.toUpperCase()} : {symbol}
          </button>

          <div style={{ display: 'flex', gap: '2px' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#2962FF' : 'transparent',
                  color: 'white', border: 'none',
                  padding: '6px 10px', cursor: 'pointer', fontSize: 13, borderRadius: 3,
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsIndicatorsOpen(true)}
            style={{ background: '#2b2b43', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto', fontSize: 14 }}
          >
            Индикаторы
          </button>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside style={{ width: '50px', borderRight: '1px solid #2b2b43', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '8px', flexShrink: 0 }}>
            <button
              title="Кисть"
              onClick={() => setIsDrawingMode(m => !m)}
              style={{
                background: isDrawingMode ? '#2962FF' : 'transparent',
                border: isDrawingMode ? '1px solid #2962FF' : '1px solid transparent',
                borderRadius: 4, color: 'white', cursor: 'pointer',
                fontSize: '18px', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              🖌
            </button>
            <button
              title="Линия тренда"
              style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: '18px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              📉
            </button>
          </aside>

          <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ChartView />
            <CanvasOverlay
              chart={chartRefs?.chart ?? null}
              series={chartRefs?.series ?? null}
              isDrawingMode={isDrawingMode}
            />
          </main>
        </div>

        {isIndicatorsOpen && <IndicatorsModal onClose={() => setIsIndicatorsOpen(false)} />}
        {isSearchOpen    && <SymbolSearchModal onClose={() => setIsSearchOpen(false)} />}
      </div>
    </ChartRefsContext.Provider>
  );
};
