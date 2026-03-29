import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspace';

type Exchange = 'bybit' | 'moex';

interface SymbolSearchModalProps {
  onClose: () => void;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({ onClose }) => {
  const { setSymbol } = useWorkspaceStore();
  const [exchange, setExchange] = useState<Exchange>('bybit');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Фокус на инпут при открытии
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const search = async (q: string, exch: Exchange) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/market/search?exchange=${exch}&query=${encodeURIComponent(q)}`,
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
    debounceRef.current = setTimeout(() => search(val, exchange), 300);
  };

  const handleExchangeChange = (exch: Exchange) => {
    setExchange(exch);
    setResults([]);
    if (query.trim()) search(query, exch);
  };

  const handleSelect = (sym: string) => {
    setSymbol(exchange, sym);
    onClose();
  };

  // Закрытие по Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '6px 0',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    transition: 'background 0.15s',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 80,
      }}
    >
      <div
        style={{
          width: 480,
          background: '#1e222d',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Заголовок */}
        <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Поиск символа</span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Биржа */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
          {(['bybit', 'moex'] as Exchange[]).map((exch) => (
            <button
              key={exch}
              onClick={() => handleExchangeChange(exch)}
              style={{
                ...btnBase,
                background: exchange === exch ? '#2962FF' : '#2b2b43',
                color: exchange === exch ? '#fff' : '#aaa',
              }}
            >
              {exch === 'bybit' ? 'Bybit' : 'MOEX'}
            </button>
          ))}
        </div>

        {/* Инпут */}
        <div style={{ padding: '10px 16px 0' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder={
              exchange === 'bybit'
                ? 'Например: BTC, ETH/USDT, SOL...'
                : 'Например: SBER, GAZP, LKOH...'
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#131722',
              border: '1px solid #2b2b43',
              borderRadius: 4,
              color: '#fff',
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Результаты */}
        <div
          style={{
            minHeight: 60,
            maxHeight: 360,
            overflowY: 'auto',
            padding: '8px 8px 8px',
            marginTop: 4,
          }}
        >
          {loading && (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              Поиск...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              Ничего не найдено
            </div>
          )}

          {!loading && results.map((sym) => (
            <button
              key={sym}
              onClick={() => handleSelect(sym)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: '#d1d4dc',
                padding: '8px 10px',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2b2b43')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  fontSize: 10,
                  background: exchange === 'bybit' ? '#1a3a5c' : '#1a3a2c',
                  color: exchange === 'bybit' ? '#2962FF' : '#26a69a',
                  padding: '2px 5px',
                  borderRadius: 3,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  minWidth: 38,
                  textAlign: 'center',
                }}
              >
                {exchange === 'bybit' ? 'BYBIT' : 'MOEX'}
              </span>
              {sym}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
