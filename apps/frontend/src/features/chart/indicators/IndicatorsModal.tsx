import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { INDICATORS_REGISTRY, IndicatorMeta } from './registry';
import { SMAForm } from './SMAForm';

interface IndicatorsModalProps {
  onClose: () => void;
}

const NEW_SMA_ID = '__new__';

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({ onClose }) => {
  const { indicators, addIndicator, removeIndicator } = useWorkspaceStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const isCreatingNew = editingId === NEW_SMA_ID;
  const editingIndicator = editingId && !isCreatingNew
    ? indicators.find((i) => i.id === editingId)
    : undefined;
  const showForm = isCreatingNew || !!editingIndicator;

  const handleAdd = (meta: IndicatorMeta) => {
    if (meta.type === 'sma') {
      setEditingId(NEW_SMA_ID);
      return;
    }
    if (meta.type === 'volume') {
      addIndicator('volume', meta.defaultParams);
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
          maxHeight: 560,
          background: '#1e222d',
          borderRadius: 8,
          padding: 16,
          color: '#d1d4dc',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>
            {showForm ? (isCreatingNew ? 'Добавить SMA' : 'Настройки SMA') : 'Индикаторы'}
          </h3>
          <button
            onClick={showForm ? () => setEditingId(null) : onClose}
            style={{ background: 'transparent', border: 'none', color: '#d1d4dc', cursor: 'pointer', fontSize: 18 }}
          >
            {showForm ? '← Назад' : '✕'}
          </button>
        </div>

        {!showForm && (
          <>
            {/* Добавить новый */}
            <div style={{ fontSize: 13, opacity: 0.8 }}>Добавить новый индикатор:</div>
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
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{meta.description}</div>
                </button>
              ))}
            </div>

            {/* Список добавленных */}
            {indicators.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <div style={{ opacity: 0.8, marginBottom: 6 }}>Уже добавлены:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {indicators.map((ind) => (
                    <div
                      key={ind.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 4,
                        background: '#131722',
                      }}
                    >
                      {/* Название и параметры */}
                      <span style={{ flex: 1, fontSize: 12 }}>
                        {ind.type.toUpperCase()}
                        {ind.type === 'sma' && (
                          <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11 }}>
                            period={ind.params.period ?? 20}
                          </span>
                        )}
                      </span>

                      {/* Кнопка настроек (только для SMA) */}
                      {ind.type === 'sma' && (
                        <button
                          onClick={() => setEditingId(ind.id)}
                          title="Настройки"
                          style={{
                            background: 'transparent',
                            border: '1px solid #2b2b43',
                            borderRadius: 4,
                            color: '#2962FF',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            fontSize: 12,
                            lineHeight: '18px',
                          }}
                        >
                          ⚙️
                        </button>
                      )}

                      {/* Кнопка удалить */}
                      <button
                        onClick={() => removeIndicator(ind.id)}
                        title="Удалить"
                        style={{
                          background: 'transparent',
                          border: '1px solid #ef5350',
                          borderRadius: 4,
                          color: '#ef5350',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          fontSize: 12,
                          lineHeight: '18px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showForm && (
          <SMAForm
            indicatorId={isCreatingNew ? undefined : editingIndicator?.id}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>
    </div>
  );
};
