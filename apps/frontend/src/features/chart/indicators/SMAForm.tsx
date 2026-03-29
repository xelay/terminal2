// apps/frontend/src/features/chart/indicators/SMAForm.tsx
import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';

interface SMAFormProps {
  indicatorId?: string;
  onClose: () => void;
}

export const SMAForm: React.FC<SMAFormProps> = ({ indicatorId, onClose }) => {
  const { indicators, addIndicator, updateIndicator, removeIndicator } = useWorkspaceStore();
  const [period, setPeriod] = useState(20);
  const [color, setColor] = useState('#2962FF');

  console.log(`[SMAForm] 🟡 render — indicatorId="${indicatorId ?? 'undefined'}"`);

  useEffect(() => {
    console.log(`[SMAForm] mounted — indicatorId="${indicatorId ?? 'undefined'}"`);
    return () => {
      console.log(`[SMAForm] unmounted — indicatorId="${indicatorId ?? 'undefined'}"`);
    };
  }, []);

  useEffect(() => {
    console.log(`[SMAForm] indicatorId effect — looking for id="${indicatorId}" in store [${indicators.map(i => i.id).join(', ')}]`);
    if (!indicatorId) return;
    const ind = indicators.find((i) => i.id === indicatorId && i.type === 'sma');
    if (ind) {
      console.log(`[SMAForm] ✅ found indicator, loading params:`, ind.params);
      setPeriod(ind.params.period ?? 20);
      setColor(ind.params.color ?? '#2962FF');
    } else {
      console.warn(`[SMAForm] ⚠️ indicator id="${indicatorId}" NOT FOUND in store!`);
    }
  }, [indicatorId, indicators]);

  const handleSave = () => {
    console.log(`[SMAForm] handleSave — indicatorId="${indicatorId}" period=${period} color=${color}`);
    if (indicatorId) {
      updateIndicator(indicatorId, { period, color });
    } else {
      addIndicator('sma', { period, color });
    }
    onClose();
  };

  const handleDelete = () => {
    console.log(`[SMAForm] handleDelete — indicatorId="${indicatorId}"`);
    if (indicatorId) {
      removeIndicator(indicatorId);
    }
    onClose();
  };

  return (
    <div style={{ background: '#1e222d', padding: 24, borderRadius: 8, width: '100%', color: '#d1d4dc' }}>
      <h3 style={{ marginTop: 0, marginBottom: 16, color: '#fff' }}>
        {indicatorId ? 'Настройки SMA' : 'Добавить SMA'}
      </h3>

      {/* Дебаг-панель */}
      <div style={{ fontSize: 11, background: '#0d1117', padding: 8, borderRadius: 4, color: '#7ec8e3', fontFamily: 'monospace', marginBottom: 16 }}>
        <div>🔍 <b>SMAForm DEBUG</b></div>
        <div>indicatorId: <b>{indicatorId ?? 'undefined'}</b></div>
        <div>period (state): <b>{period}</b></div>
        <div>color (state): <b>{color}</b></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Период</label>
        <input
          type="number"
          min={1}
          max={500}
          value={period}
          onChange={(e) => {
            const v = Number(e.target.value);
            console.log(`[SMAForm] period changed → ${v}`);
            setPeriod(v);
          }}
          style={{ width: '100%', padding: 8, background: '#131722', border: '1px solid #2b2b43', color: '#fff', borderRadius: 4 }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Цвет линии</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              console.log(`[SMAForm] color changed → ${e.target.value}`);
              setColor(e.target.value);
            }}
            style={{ width: 32, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
          />
          <span>{color}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        {indicatorId && (
          <button
            onClick={handleDelete}
            style={{ marginRight: 'auto', padding: '8px 16px', borderRadius: 4, border: '1px solid #ef5350', color: '#ef5350', background: 'transparent', cursor: 'pointer' }}
          >
            Удалить
          </button>
        )}
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: 4, background: '#2b2b43', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          style={{ padding: '8px 16px', borderRadius: 4, background: '#2962FF', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};
