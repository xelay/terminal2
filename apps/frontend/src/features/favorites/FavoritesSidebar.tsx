import React from 'react';
import { useWorkspaceStore, FavoriteSymbol } from '../../store/workspace';
import { CHART_THEMES } from '../chart/lwc/useLightweightChart';

const IconChevronLeft = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconStar = ({ filled, size = 11 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? '#f5c518' : 'none'}
    stroke={filled ? '#f5c518' : '#9598a1'}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const EXCHANGE_SHORT: Record<string, string> = {
  moex: 'MOEX',
  bybit: 'BYBIT',
};

// Фиксированная ширина панели — не влияет на размер графика
const PANEL_WIDTH = 130;

interface Props {
  open: boolean;
  onToggle: () => void;
}

export const FavoritesSidebar: React.FC<Props> = ({ open, onToggle }) => {
  const { favorites, exchange, symbol, setSymbol, theme, toggleFavorite } = useWorkspaceStore();
  const isDark = theme === 'dark';
  const colors = CHART_THEMES[theme];

  const sorted = [...favorites].sort((a, b) => {
    const exCmp = a.exchange.localeCompare(b.exchange);
    return exCmp !== 0 ? exCmp : a.symbol.localeCompare(b.symbol);
  });

  const borderColor = isDark ? '#2b2b43' : '#e0e3eb';
  const hoverBg     = isDark ? '#2b2b43' : '#f0f3fa';
  const activeBg    = isDark ? '#2962FF22' : '#2962FF11';
  const chevronBg   = isDark ? '#1a1e2e' : '#f0f2f8';

  return (
    /*
      В потоке flex остаётся только шеврон (14пх фикс) —
      он всегда виден и не меняет ширину соседей.
      Панель со списком absolute — выезжает поверх графика.
    */
    <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>

      {/* Шеврон — в потоке, 14пх, неизменный */}
      <button
        onClick={onToggle}
        title={open ? 'Скрыть избранное' : 'Избранное'}
        style={{
          width: 14,
          alignSelf: 'stretch',
          background: chevronBg,
          border: 'none',
          borderRight: `1px solid ${borderColor}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          color: isDark ? '#9598a1' : '#888',
          zIndex: 11,
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b2b43' : '#e2e5ef'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = chevronBg; }}
      >
        {open ? <IconChevronLeft /> : <IconChevronRight />}
      </button>

      {/* Панель — absolute, выезжает поверх графика */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 14, // рядом с шевроном
        width: PANEL_WIDTH,
        height: '100%',
        background: colors.bg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        overflow: 'hidden',
        // Слайд левой части графика, правая шкала недвижима
        transform: open ? 'translateX(0)' : `translateX(-${PANEL_WIDTH + 2}px)`,
        transition: 'transform 0.18s ease',
        boxShadow: open
          ? (isDark ? '2px 0 8px rgba(0,0,0,0.3)' : '2px 0 8px rgba(0,0,0,0.08)')
          : 'none',
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '7px 10px 6px',
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          color: isDark ? '#9598a1' : '#777',
          borderBottom: `1px solid ${borderColor}`,
          whiteSpace: 'nowrap', userSelect: 'none',
          flexShrink: 0,
        }}>
          ★ Избранное
        </div>

        {/* Список */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {sorted.length === 0 && (
            <div style={{ padding: '10px', fontSize: 11, color: isDark ? '#9598a1' : '#aaa', whiteSpace: 'nowrap' }}>
              Пусто
            </div>
          )}
          {sorted.map((fav: FavoriteSymbol) => {
            const isActive = fav.exchange === exchange && fav.symbol === symbol;
            return (
              <div
                key={`${fav.exchange}:${fav.symbol}`}
                onClick={() => setSymbol(fav.exchange, fav.symbol)}
                title={`${EXCHANGE_SHORT[fav.exchange] ?? fav.exchange.toUpperCase()}: ${fav.symbol}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                  padding: '5px 6px 5px 10px',
                  cursor: 'pointer',
                  background: isActive ? activeBg : 'transparent',
                  borderLeft: isActive ? '2px solid #2962FF' : '2px solid transparent',
                  transition: 'background 0.12s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#2962FF' : colors.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fav.symbol}
                  </div>
                  <div style={{ fontSize: 9, color: isDark ? '#9598a1' : '#888', marginTop: 1 }}>
                    {EXCHANGE_SHORT[fav.exchange] ?? fav.exchange.toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(fav.exchange, fav.symbol); }}
                  title="Убрать"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.55,
                  }}
                >
                  <IconStar filled size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
