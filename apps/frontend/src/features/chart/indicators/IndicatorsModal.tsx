import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { INDICATORS_REGISTRY, IndicatorMeta } from './registry';
import { SMAForm } from './SMAForm';

interface IndicatorsModalProps {
  onClose: () => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({ onClose }) => {
  const { indicators, addIndicator } = useWorkspaceStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingIndicator = indicators.find((i) => i.id === editingId);

  const handleAdd = (meta: IndicatorMeta) => {
    if (meta.type === 'sma') {
      // создаём с дефолтными параметрами, но сразу открываем форму
      const id = `${meta.type}_${Date.now()}`;
      addIndicator(meta.type, { ...meta.defaultParams, idOverride: id });
      setEditingId(id);
    }
    if (meta.type === 'volume') {
      addIndicator('volume', meta.defaultParams);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 420,
          maxHeight: 520,
          background: '#1e222d',
          borderRadius: 8,
          padding: 16,
          color: '#d1d4dc',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>Индикаторы</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d1d4dc',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {!editingIndicator && (
          <>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Добавить новый индикатор:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INDICATORS_REGISTRY.map((meta) => (
                <button
                  key={meta.type}
                  onClick={() => handleAdd(meta)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: '#131722',
                    borderRadius: 4,
                    border: '1px solid #2b2b43',
                    padding: '8px 12px',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14 }}>{meta.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {meta.description}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 13 }}>
              Уже добавлены:
              {indicators.length === 0 && ' нет активных индикаторов'}
              {indicators.length > 0 && (
                <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                  {indicators.map((ind) => (
                    <li key={ind.id} style={{ fontSize: 12 }}>
                      {ind.type.toUpperCase()} (id: {ind.id})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {editingIndicator && (
          <SMAForm
            indicatorId={editingIndicator.id}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>
    </div>
  );
};
