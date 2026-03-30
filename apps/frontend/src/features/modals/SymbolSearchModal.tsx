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

const EXCHANGE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  bybit: { label: 'BYBIT', bg: '#1a3a5c', color: '#2962FF' },
  moex:  { label: 'MOEX',  bg: '#1a3a2c', color: '#26a69a' },
};

export const SymbolSearchModal: React.FC<Props> = ({ onClose }) => {
  const { setSymbol, theme } = useWorkspaceStore();
  const isDark = theme === 'dark';

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
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
      // Без exchange — бэк ищет по всем биржам параллельно
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

  const bg      = isDark ? '#1e222d' : '#fff';
  const inputBg = isDark ? '#131722' : '#f5f5fa';
  const border  = isDark ? '#2b2b43' : '#dde1eb';
  const textColor = isDark ? '#d1d4dc' : '#131722';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 200, display: 'flex',
        justifyContent: 'center', alignItems: 'flex-start', paddingTop: 80,
      }}
    >
      <div style={{
        width: 520, background: bg, borderRadius: 8,
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '14px 16px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${border}`,
        }}>
          <span style={{ color: textColor, fontWeight: 600, fontSize: 15 }}>Поиск символа</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Инпут */}
        <div style={{ padding: '12px 16px' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="SBER, BTC/USDT, GAZP, ETH..."
            style={{
              width: '100%', padding: '10px 12px',
              background: inputBg, border: `1px solid ${border}`,
              borderRadius: 4, color: textColor, fontSize: 14,
              boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        {/* Результаты */}
        <div style={{ minHeight: 60, maxHeight: 380, overflowY: 'auto', paddingBottom: 8 }}>
          {loading && (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Поиск...
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Ничего не найдено
            </div>
          )}
          {!loading && results.map((r, i) => {
            const exMeta = EXCHANGE_LABEL[r.exchange] ?? { label: r.exchange.toUpperCase(), bg: '#2b2b43', color: '#aaa' };
            return (
              <button
                key={`${r.exchange}:${r.symbol}:${i}`}
                onClick={() => handleSelect(r)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  borderRadius: 0, color: textColor,
                  padding: '8px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b2b43' : '#f0f3fa'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {/* Бейдж биржи */}
                <span style={{
                  fontSize: 10, background: exMeta.bg, color: exMeta.color,
                  padding: '2px 5px', borderRadius: 3,
                  fontWeight: 700, letterSpacing: 0.5,
                  minWidth: 42, textAlign: 'center', flexShrink: 0,
                }}>
                  {exMeta.label}
                </span>
                {/* Символ + дескрипшн */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>
                    {r.symbol}
                  </div>
                  {r.description && r.description !== r.symbol && (
                    <div style={{
                      fontSize: 11, color: isDark ? '#9598a1' : '#888',
                      marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
