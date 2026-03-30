import React, { useState, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { useChartRefs } from '../ChartRefsContext';
import { calcATR, smartRound, PriceSource } from './renkoUtils';

interface Props {
  indicatorId?: string;
  onClose: () => void;
}

export const RenkoForm: React.FC<Props> = ({ indicatorId, onClose }) => {
  const { addIndicator, updateIndicator, indicators } = useWorkspaceStore();
  const { candlesRef } = useChartRefs();
  const existing = indicatorId ? indicators.find(i => i.id === indicatorId) : undefined;

  // Читаем свечи напрямую из ref — всегда актуальные
  const candles = candlesRef?.current ?? [];
  const refPrice = candles.length > 0 ? candles[candles.length - 1].close : 1000;

  const defaultATR = useMemo(() => {
    if (candles.length < 2) return smartRound(refPrice * 0.01, refPrice);
    const atr = calcATR(candles);
    return atr > 0 ? smartRound(atr, refPrice) : smartRound(refPrice * 0.01, refPrice);
  // пересчитываем один раз при открытии формы
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [blockSize, setBlockSize] = useState<number>(existing?.params.blockSize ?? defaultATR);
  const [source,    setSource]    = useState<PriceSource>(existing?.params.source    ?? 'close');
  const [bullColor, setBullColor] = useState<string>(existing?.params.bullColor ?? '#26a69a');
  const [bearColor, setBearColor] = useState<string>(existing?.params.bearColor ?? '#ef5350');
  const [opacity,   setOpacity]   = useState<number>(existing?.params.opacity   ?? 0.3);

  const handleResetATR = () => setBlockSize(defaultATR);

  const handleSave = () => {
    const params = { blockSize, source, bullColor, bearColor, opacity };
    if (existing) updateIndicator(existing.id, params);
    else addIndicator('renko', params);
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    background: '#131722', border: '1px solid #2b2b43', borderRadius: 4,
    color: '#d1d4dc', padding: '6px 10px', fontSize: 13,
    flex: 1, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div>
        <div style={labelStyle}>Размер блока</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number" min={0.00001}
            step={refPrice > 100 ? 1 : refPrice > 10 ? 0.1 : 0.01}
            value={blockSize}
            onChange={e => setBlockSize(Number(e.target.value))}
            style={inputStyle}
          />
          <button
            onClick={handleResetATR}
            title={`Сбросить до ATR(50) ≈ ${defaultATR}`}
            style={{
              background: '#2b2b43', border: 'none', borderRadius: 4,
              color: '#d1d4dc', cursor: 'pointer', padding: '6px 10px',
              fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            ATR 50
          </button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
          Авто-округление: {refPrice > 100 ? 'до целых' : refPrice > 10 ? 'до десятых' : 'до сотых'}
          {candles.length > 0 && <span style={{ marginLeft: 8, color: '#2962FF' }}>≈ {defaultATR}</span>}
        </div>
      </div>

      <div>
        <div style={labelStyle}>Источник цены</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['close', 'highlow'] as PriceSource[]).map(s => (
            <button key={s} onClick={() => setSource(s)} style={{
              flex: 1, padding: '6px 0', borderRadius: 4, cursor: 'pointer',
              border: source === s ? '1px solid #2962FF' : '1px solid #2b2b43',
              background: source === s ? '#2962FF22' : '#131722',
              color: source === s ? '#2962FF' : '#d1d4dc', fontSize: 13,
            }}>
              {s === 'close' ? 'Open / Close' : 'High / Low'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Цвет роста</div>
          <input type="color" value={bullColor} onChange={e => setBullColor(e.target.value)}
            style={{ ...inputStyle, padding: 2, height: 36, cursor: 'pointer', width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Цвет падения</div>
          <input type="color" value={bearColor} onChange={e => setBearColor(e.target.value)}
            style={{ ...inputStyle, padding: 2, height: 36, cursor: 'pointer', width: '100%' }} />
        </div>
      </div>

      <div>
        <div style={labelStyle}>Прозрачность ({Math.round(opacity * 100)}%)</div>
        <input type="range" min={5} max={80} value={Math.round(opacity * 100)}
          onChange={e => setOpacity(Number(e.target.value) / 100)}
          style={{ width: '100%' }} />
      </div>

      <button onClick={handleSave} style={{
        background: '#2962FF', color: '#fff', border: 'none',
        borderRadius: 4, padding: '8px 0', cursor: 'pointer', fontSize: 14,
      }}>
        {existing ? 'Сохранить' : 'Добавить'}
      </button>
    </div>
  );
};
