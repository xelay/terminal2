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

// SVG-иконки для тулбара
const IconBrush = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.48 1 3.5 1 1.96 0 3.5-1.54 3.5-3.5-.01-1.67-1.35-3.04-3-3.04z" />
  </svg>
);

const IconTrendLine = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="20" x2="21" y2="4" />
    <circle cx="3" cy="20" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="21" cy="4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe } = useWorkspaceStore();
  const [isSearchOpen, setIsSearchOpen]         = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isDrawingMode, setIsDrawingMode]       = useState(false);
  const [chartRefs, setChartRefs] = useState<{ chart: any; series: any } | null>(null);

  const toolBtnStyle = (active = false): React.CSSProperties => ({
    background: active ? '#2962FF' : 'transparent',
    border: active ? '1px solid #2962FF' : '1px solid transparent',
    borderRadius: 4,
    color: active ? 'white' : '#9598a1',
    cursor: 'pointer',
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  });

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
          <aside style={{ width: '50px', borderRight: '1px solid #2b2b43', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '4px', flexShrink: 0 }}>
            <button
              title="Кисть"
              onClick={() => setIsDrawingMode(m => !m)}
              style={toolBtnStyle(isDrawingMode)}
            >
              <IconBrush />
            </button>

            <button
              title="Линия тренда (скоро)"
              style={toolBtnStyle(false)}
            >
              <IconTrendLine />
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
