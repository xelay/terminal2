import React, { useState, useEffect } from 'react';
import { ChartView } from '../features/chart/ChartView';
import { IndicatorsModal } from '../features/chart/indicators/IndicatorsModal';
import { SymbolSearchModal } from '../features/modals/SymbolSearchModal';
import { CanvasOverlay } from '../features/drawings/CanvasOverlay';
import { ChartRefsContext } from '../features/chart/ChartRefsContext';
import { FavoritesSidebar } from '../features/favorites/FavoritesSidebar';
import { useWorkspaceStore } from '../store/workspace';
import { useSessionStore } from '../store/session';
import { Timeframe } from '../store/workspace';
import { CHART_THEMES } from '../features/chart/lwc/useLightweightChart';
import '../styles/globals.css';

export type DrawingTool = 'brush' | 'trendline' | null;

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
const ICON_DEFAULT = '#9598a1';
const ICON_ACTIVE  = '#ffffff';
const BACKEND_URL  = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
    <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
    <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
    <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09z"/>
  </svg>
);
const IconStar = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24"
    fill={filled ? '#f5c518' : 'none'}
    stroke={filled ? '#f5c518' : '#9598a1'}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'fill 0.15s, stroke 0.15s' }}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const App: React.FC = () => {
  const { exchange, symbol, timeframe, setTimeframe, theme, setTheme, toggleFavorite, isFavorite } = useWorkspaceStore();
  const { isLoggedIn, logout } = useSessionStore();

  const [isSearchOpen, setIsSearchOpen]         = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [activeTool, setActiveTool]             = useState<DrawingTool>(null);
  const [chartRefs, setChartRefs]               = useState<{ chart: any; series: any } | null>(null);
  const [candlesRef, setCandlesRef]             = useState<React.MutableRefObject<any[]> | null>(null);
  const [favOpen, setFavOpen]                   = useState(true);

  const isDark = theme === 'dark';
  const colors = CHART_THEMES[theme];
  const starred = isFavorite(exchange, symbol);

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
    <ChartRefsContext.Provider value={{ chartRefs, setChartRefs, candlesRef, setCandlesRef }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: colors.bg, color: colors.text,
        transition: 'background 0.2s, color 0.2s',
      }}>
        {/* ===== Хедер ===== */}
        <header style={{
          height: '50px',
          borderBottom: `1px solid ${isDark ? '#2b2b43' : '#e0e3eb'}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setIsSearchOpen(true)} style={secondaryBtnStyle}>
              {exchange.toUpperCase()} : {symbol}
            </button>
            <button
              onClick={() => toggleFavorite(exchange, symbol)}
              title={starred ? 'Удалить из избранного' : 'Добавить в избранное'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 6px', display: 'flex', alignItems: 'center', borderRadius: 4,
              }}
            >
              <IconStar filled={starred} />
            </button>
          </div>
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
                <IconGoogle /> Войти
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

        {/* ===== Основной контент ===== */}
        {/*
          Порядок слева направо:
          [Избранное (панель + шеврон)] [Инструменты] [График]
        */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* 1. Сайдбар избранного */}
          <FavoritesSidebar open={favOpen} onToggle={() => setFavOpen(v => !v)} />

          {/* 2. Тулбар рисования */}
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

          {/* 3. График */}
          <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ChartView />
            <CanvasOverlay
              chart={chartRefs?.chart ?? null}
              series={chartRefs?.series ?? null}
              activeTool={activeTool}
            />
          </main>
        </div>

        {isIndicatorsOpen && <IndicatorsModal onClose={() => setIsIndicatorsOpen(false)} />}
        {isSearchOpen && <SymbolSearchModal onClose={() => setIsSearchOpen(false)} />}
      </div>
    </ChartRefsContext.Provider>
  );
};
