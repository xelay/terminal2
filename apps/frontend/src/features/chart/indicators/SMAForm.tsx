// apps/frontend/src/features/chart/indicators/SMAForm.tsx
import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';

interface SMAFormProps {
  indicatorId?: string; // undefined = режим создания нового
  onClose: () => void;
}

export const SMAForm: React.FC<SMAFormProps> = ({ indicatorId, onClose }) => {
  const { indicators, addIndicator, updateIndicator, removeIndicator } = useWorkspaceStore();
  const [period, setPeriod] = useState(20);
  const [color, setColor] = useState('#2962FF');

  // Загрузить параметры при редактировании существующего
  useEffect(() => {
    if (!indicatorId) return;
    const ind = indicators.find((i) => i.id === indicatorId && i.type === 'sma');
    if (ind) {
      setPeriod(ind.params.period ?? 20);
      setColor(ind.params.color ?? '#2962FF');
    }
  }, [indicatorId]);

  const handleSave = () => {
    if (indicatorId) {
      updateIndicator(indicatorId, { period, color });
    } else {
      addIndicator('sma', { period, color });
    }
    onClose();
  };

  const handleDelete = () => {
    if (indicatorId) removeIndicator(indicatorId);
    onClose();
  };

  return (
    <div style={{ color: '#d1d4dc' }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 8, opacity: 0.7 }}>
          Период
        </label>
        <input
          type="number"
          min={1}
          max={500}
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          style={{
            width: '100%',
            padding: 8,
            background: '#131722',
            border: '1px solid #2b2b43',
            color: '#fff',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 8, opacity: 0.7 }}>
          Цвет линии
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 32, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>{color}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {indicatorId && (
          <button
            onClick={handleDelete}
            style={{
              marginRight: 'auto',
              padding: '8px 16px',
              borderRadius: 4,
              border: '1px solid #ef5350',
              color: '#ef5350',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Удалить
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            background: '#2b2b43',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            background: '#2962FF',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};
