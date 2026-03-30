import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspace';

interface SymbolResult {
  exchange: string;
  symbol: string;
  description: string;
}

interface Props {
  onClose: () => void;
}

const EXCHANGE_META: Record<string, {
  label: string;
  dark:  { bg: string; color: string; border: string };
  light: { bg: string; color: string; border: string };
}> = {
  bybit: {
    label: 'BYBIT',
    dark:  { bg: '#0d1f3c', color: '#4d8af0', border: '#1e3a6e' },
    light: { bg: '#e8f0fe', color: '#1a56db', border: '#b8d0f8' },
  },
  moex: {
    label: 'MOEX',
    dark:  { bg: '#0d2a1f', color: '#26a69a', border: '#1a4a3a' },
    light: { bg: '#e6f4f1', color: '#0f7a6e', border: '#b2dbd6' },
  },
  tinkoff: {
    label: 'T-INV',
    dark:  { bg: '#2a1a00', color: '#ffaa00', border: '#4a3000' },
    light: { bg: '#fff8e6', color: '#b36b00', border: '#ffd980' },
  },
};

const getFallbackMeta = (exchange: string, isDark: boolean) => ({
  label: exchange.toUpperCase().slice(0, 6),
  ...(isDark
    ? { bg: '#2b2b43', color: '#aaa', border: '#3a3a55' }
    : { bg: '#f0f0f5', color: '#666', border: '#d0d0df' }),
});

export const SymbolSearchModal: React.FC<Props> = ({ onClose }) => {
  const { setSymbol, theme } = useWorkspaceStore();
  const isDark = theme === 'dark';

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/market/search?query=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setResults(data.symbols || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (r: SymbolResult) => {
    setSymbol(r.exchange, r.symbol);
    onClose();
  };

  const modalBg  = isDark ? '#1e222d' : '#ffffff';
  const inputBg  = isDark ? '#131722' : '#f8f9fb';
  const border   = isDark ? '#2b2b43' : '#e2e5ed';
  const textMain = isDark ? '#d1d4dc' : '#131722';
  const textSub  = isDark ? '#9598a1' : '#6b7280';
  const hoverBg  = isDark ? '#262b3a' : '#f3f5fb';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(30,34,45,0.35)',
        zIndex: 200, display: 'flex',
        justifyContent: 'center', alignItems: 'flex-start', paddingTop: 72,
      }}
    >
      <div style={{
        width: 520, background: modalBg, borderRadius: 10,
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 12px 40px rgba(0,0,0,0.55)'
          : '0 8px 40px rgba(0,0,0,0.14)',
        border: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '14px 16px 13px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${border}`,
        }}>
          <span style={{ color: textMain, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
            Поиск символа
          </span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: textSub, cursor: 'pointer', fontSize: 18,
            lineHeight: 1, padding: '0 2px',
            display: 'flex', alignItems: 'center',
          }}>×</button>
        </div>

        {/* Инпут */}
        <div style={{ padding: '12px 14px' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="SBER, BTC/USDT, GAZP, ETH…"
            style={{
              width: '100%', padding: '9px 12px',
              background: inputBg,
              border: `1px solid ${border}`,
              borderRadius: 6, color: textMain, fontSize: 14,
              boxSizing: 'border-box', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2962FF'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = border; }}
          />
        </div>

        {/* Результаты */}
        <div style={{ minHeight: 60, maxHeight: 400, overflowY: 'auto', paddingBottom: 6 }}>
          {loading && (
            <div style={{ color: textSub, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Поиск…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ color: textSub, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Ничего не найдено
            </div>
          )}
          {!loading && results.map((r, i) => {
            const meta = EXCHANGE_META[r.exchange];
            const badge = meta
              ? (isDark ? meta.dark : meta.light)
              : getFallbackMeta(r.exchange, isDark);
            const label = meta?.label ?? r.exchange.toUpperCase().slice(0, 6);

            return (
              <button
                key={`${r.exchange}:${r.symbol}:${i}`}
                onClick={() => handleSelect(r)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  color: textMain, padding: '7px 14px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.04em',
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${'border' in badge ? badge.border : 'transparent'}`,
                  padding: '2px 6px',
                  borderRadius: 4,
                  minWidth: 44, textAlign: 'center', flexShrink: 0,
                }}>
                  {label}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textMain, letterSpacing: '-0.01em' }}>
                    {r.symbol}
                  </div>
                  {r.description && r.description !== r.symbol && (
                    <div style={{
                      fontSize: 11, color: textSub, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
