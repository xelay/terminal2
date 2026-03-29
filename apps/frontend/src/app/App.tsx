import React, { useState } from 'react';
import { ChartView } from '../features/chart/ChartView';
import { IndicatorsModal } from '../features/chart/indicators/IndicatorsModal';
import { SymbolSearchModal } from '../features/modals/SymbolSearchModal';
import { useWorkspaceStore } from '../store/workspace';
import '../styles/globals.css';

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe } = useWorkspaceStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);

  return (
    <div className="terminal-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#131722', color: 'white' }}>

      {/* Top Header */}
      <header style={{ height: '50px', borderBottom: '1px solid #2b2b43', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px' }}>
        <button
          onClick={() => setIsSearchOpen(true)}
          style={{ background: '#2b2b43', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: 14 }}
        >
          {exchange.toUpperCase()} : {symbol}
        </button>

        <div style={{ display: 'flex', gap: '4px' }}>
          {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as any)}
              style={{ background: timeframe === tf ? '#2962FF' : 'transparent', color: 'white', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
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
        {/* Left Toolbar */}
        <aside style={{ width: '50px', borderRight: '1px solid #2b2b43', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
          <button title="Кисть" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>🖌</button>
          <button title="Линия тренда" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px', marginTop: '16px' }}>📉</button>
        </aside>

        {/* Main Chart Area */}
        <main style={{ flex: 1 }}>
          <ChartView />
        </main>
      </div>

      {isIndicatorsOpen && (
        <IndicatorsModal onClose={() => setIsIndicatorsOpen(false)} />
      )}

      {isSearchOpen && (
        <SymbolSearchModal onClose={() => setIsSearchOpen(false)} />
      )}
    </div>
  );
};
