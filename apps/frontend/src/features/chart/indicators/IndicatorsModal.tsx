import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { INDICATORS_REGISTRY, IndicatorMeta } from './registry';
import { SMAForm } from './SMAForm';

interface IndicatorsModalProps {
  onClose: () => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({ onClose }) => {
  const { indicators, addIndicator, removeAllIndicators } = useWorkspaceStore();
  // 'list' = список, 'new' = форма создания, '<id>' = форма редактирования
  const [mode, setMode] = useState<'list' | 'new' | string>('list');

  const editingIndicator =
    mode !== 'list' && mode !== 'new'
      ? indicators.find((i) => i.id === mode)
      : undefined;

  const handleAddClick = (meta: IndicatorMeta) => {
    if (meta.type === 'sma') {
      // Открываем форму — индикатор добавится только при нажатии «Сохранить» внутри SMAForm
      setMode('new');
      return;
    }
    if (meta.type === 'volume') {
      addIndicator('volume', {});
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
          maxHeight: 560,
          background: '#1e222d',
          borderRadius: 8,
          padding: 16,
          color: '#d1d4dc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>
            {mode === 'list'
              ? 'Индикаторы'
              : mode === 'new'
              ? 'Добавить SMA'
              : 'Настройки SMA'}
          </h3>
          <button
            onClick={mode === 'list' ? onClose : () => setMode('list')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d1d4dc',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            {mode === 'list' ? '✕' : '← Назад'}
          </button>
        </div>

        {/* Список индикаторов */}
        {mode === 'list' && (
          <>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Добавить новый индикатор:</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INDICATORS_REGISTRY.map((meta) => (
                <button
                  key={meta.type}
                  onClick={() => handleAddClick(meta)}
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

            <div style={{ fontSize: 13, marginTop: 4 }}>
              Уже добавлены:
              {indicators.length === 0 && (
                <span style={{ opacity: 0.6 }}> нет активных индикаторов</span>
              )}
            </div>

            {indicators.length > 0 && (
              <>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {indicators.map((ind) => (
                    <li
                      key={ind.id}
                      style={{
                        fontSize: 12,
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>
                        {ind.type.toUpperCase()}
                        {ind.type === 'sma' && ` (period: ${ind.params.period ?? 20})`}
                      </span>
                      {ind.type === 'sma' && (
                        <span
                          onClick={() => setMode(ind.id)}
                          style={{ fontSize: 10, color: '#2962FF', cursor: 'pointer' }}
                        >
                          ✎ настройки
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => removeAllIndicators()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: '1px solid #ef5350',
                    color: '#ef5350',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    alignSelf: 'flex-start',
                  }}
                >
                  Очистить все индикаторы
                </button>
              </>
            )}
          </>
        )}

        {/* Форма создания нового SMA */}
        {mode === 'new' && (
          <SMAForm
            indicatorId={undefined}
            onClose={() => setMode('list')}
          />
        )}

        {/* Форма редактирования существующего SMA */}
        {mode !== 'list' && mode !== 'new' && editingIndicator && (
          <SMAForm
            indicatorId={editingIndicator.id}
            onClose={() => setMode('list')}
          />
        )}
      </div>
    </div>
  );
};
