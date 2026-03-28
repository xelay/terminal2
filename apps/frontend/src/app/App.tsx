 import React, { useState } from 'react';
import { ChartView } from '../features/chart/ChartView';
import { useWorkspaceStore } from '../store/workspace';
import '../styles/globals.css';

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe, setSymbol } = useWorkspaceStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="terminal-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#131722', color: 'white' }}>
      
      {/* Top Header */}
      <header style={{ height: '50px', borderBottom: '1px solid #2b2b43', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px' }}>
        <button onClick={() => setIsSearchOpen(true)} style={{ background: '#2b2b43', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
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
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Toolbar (Инструменты рисования) */}
        <aside style={{ width: '50px', borderRight: '1px solid #2b2b43', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
          <button title="Кисть" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>🖌</button>
          <button title="Линия тренда" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px', marginTop: '16px' }}>📉</button>
        </aside>

        {/* Main Chart Area */}
        <main style={{ flex: 1 }}>
          <ChartView />
        </main>
      </div>

      {/* Модалка поиска (пример реализации) */}
      {isSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#1e222d', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h3>Search Symbol</h3>
            {/* Здесь инпут с запросом на /api/market/search */}
            <input type="text" placeholder="BTC..." style={{ width: '100%', padding: '8px', marginTop: '16px', background: '#131722', color: 'white', border: '1px solid #2b2b43' }} />
            <button onClick={() => { setSymbol('bybit', 'ETH/USDT'); setIsSearchOpen(false); }} style={{ marginTop: '16px', width: '100%', padding: '8px', background: '#2962FF', color: 'white', border: 'none', cursor: 'pointer' }}>
              Select ETH/USDT (Example)
            </button>
            <button onClick={() => setIsSearchOpen(false)} style={{ marginTop: '8px', width: '100%', padding: '8px', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

