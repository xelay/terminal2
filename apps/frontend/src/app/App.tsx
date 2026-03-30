import React, { useState, useEffect } from 'react';
import { ChartView } from '../features/chart/ChartView';
import { IndicatorsModal } from '../features/chart/indicators/IndicatorsModal';
import { SymbolSearchModal } from '../features/modals/SymbolSearchModal';
import { CanvasOverlay } from '../features/drawings/CanvasOverlay';
import { ChartRefsContext } from '../features/chart/ChartRefsContext';
import { useWorkspaceStore } from '../store/workspace';
import { useSessionStore } from '../store/session';
import { Timeframe } from '../store/workspace';
import { CHART_THEMES } from '../features/chart/lwc/useLightweightChart';
import '../styles/globals.css';

export type DrawingTool = 'brush' | 'trendline' | null;

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

const ICON_DEFAULT = '#9598a1';
const ICON_ACTIVE  = '#ffffff';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const IconBrush = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.48 1 3.5 1 1.96 0 3.5-1.54 3.5-3.5-.01-1.67-1.35-3.04-3-3.04z" />
  </svg>
);

const IconTrendLine = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="20" x2="21" y2="4" />
    <circle cx="3" cy="20" r="1.5" fill={color} stroke="none" />
    <circle cx="21" cy="4" r="1.5" fill={color} stroke="none" />
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconGoogle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe, theme, setTheme } = useWorkspaceStore();
  const { isLoggedIn, logout } = useSessionStore();

  const [isSearchOpen, setIsSearchOpen]         = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [activeTool, setActiveTool]             = useState<DrawingTool>(null);
  const [chartRefs, setChartRefs]               = useState<{ chart: any; series: any } | null>(null);
  // candlesRef для передачи в RenkoForm (через портал из ChartView)
  const candlesForModal = React.useRef<any[]>([]);

  const isDark = theme === 'dark';
  const colors = CHART_THEMES[theme];

  const toggleTool = (tool: DrawingTool) =>
    setActiveTool(prev => (prev === tool ? null : tool));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTool(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#2962FF' : 'transparent',
    border: active ? '1px solid #2962FF' : '1px solid transparent',
    borderRadius: 4, cursor: 'pointer',
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s', padding: 0, outline: 'none',
  });

  const secondaryBtnStyle: React.CSSProperties = {
    background: isDark ? '#2b2b43' : '#f0f3fa',
    color: colors.text, border: 'none', borderRadius: '4px',
    cursor: 'pointer', fontSize: 14, padding: '6px 14px', whiteSpace: 'nowrap',
  };

  return (
    <ChartRefsContext.Provider value={{ chartRefs, setChartRefs }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: colors.bg, color: colors.text,
        transition: 'background 0.2s, color 0.2s',
      }}>
        <header style={{
          height: '50px',
          borderBottom: `1px solid ${isDark ? '#2b2b43' : '#e0e3eb'}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px', flexShrink: 0,
        }}>
          <button onClick={() => setIsSearchOpen(true)} style={secondaryBtnStyle}>
            {exchange.toUpperCase()} : {symbol}
          </button>

          <div style={{ display: 'flex', gap: '2px' }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{
                background: timeframe === tf ? '#2962FF' : 'transparent',
                color: timeframe === tf ? '#fff' : colors.text,
                border: 'none', padding: '6px 10px',
                cursor: 'pointer', fontSize: 13, borderRadius: 3,
              }}>{tf}</button>
            ))}
          </div>

          <button onClick={() => setIsIndicatorsOpen(true)} style={secondaryBtnStyle}>
            Индикаторы
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLoggedIn ? (
              <button onClick={logout} style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 12, color: '#ef5350' }}>
                Выйти
              </button>
            ) : (
              <button onClick={handleGoogleLogin} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
                <IconGoogle />Войти
              </button>
            )}
            <button
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ ...secondaryBtnStyle, padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside style={{
            width: '50px',
            borderRight: `1px solid ${isDark ? '#2b2b43' : '#e0e3eb'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '16px 0', gap: '4px', flexShrink: 0,
          }}>
            <button title="Кисть" onClick={() => toggleTool('brush')} style={toolBtnStyle(activeTool === 'brush')}>
              <IconBrush color={activeTool === 'brush' ? ICON_ACTIVE : ICON_DEFAULT} />
            </button>
            <button title="Линия тренда" onClick={() => toggleTool('trendline')} style={toolBtnStyle(activeTool === 'trendline')}>
              <IconTrendLine color={activeTool === 'trendline' ? ICON_ACTIVE : ICON_DEFAULT} />
            </button>
          </aside>

          <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ChartView />
            <CanvasOverlay
              chart={chartRefs?.chart ?? null}
              series={chartRefs?.series ?? null}
              activeTool={activeTool}
            />
          </main>
        </div>

        {isIndicatorsOpen && (
          <IndicatorsModal
            onClose={() => setIsIndicatorsOpen(false)}
            candles={candlesForModal.current}
          />
        )}
        {isSearchOpen && <SymbolSearchModal onClose={() => setIsSearchOpen(false)} />}
      </div>
    </ChartRefsContext.Provider>
  );
};
