import React, { useState, useEffect } from 'react';
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

  // Логирование при открытии модала
  useEffect(() => {
    console.log('[IndicatorsModal] 🟢 mounted. Current indicators in store:', indicators.map(i => ({ id: i.id, type: i.type })));
    return () => {
      console.log('[IndicatorsModal] 🔴 unmounted');
    };
  }, []);

  // Логирование при изменении editingId
  useEffect(() => {
    console.log(`[IndicatorsModal] editingId changed → "${editingId}"`);
    console.log(`[IndicatorsModal] editingIndicator resolved to:`, editingIndicator ?? 'undefined (not found in store)');
    if (editingId && !editingIndicator) {
      console.warn(`[IndicatorsModal] ⚠️ editingId="${editingId}" NOT FOUND in indicators:`, indicators.map(i => i.id));
    }
  }, [editingId, editingIndicator]);

  const handleAdd = (meta: IndicatorMeta) => {
    console.log(`[IndicatorsModal] handleAdd called for type="${meta.type}"`);
    if (meta.type === 'sma') {
      const id = `${meta.type}_${Date.now()}`;
      console.log(`[IndicatorsModal] → generated id="${id}", calling addIndicator...`);
      addIndicator('sma', { ...meta.defaultParams, id });
      console.log(`[IndicatorsModal] → addIndicator done, calling setEditingId("${id}")...`);
      setEditingId(id);
      return;
    }
    if (meta.type === 'volume') {
      console.log(`[IndicatorsModal] → adding volume indicator`);
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
          overflowY: 'auto',
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

        {/* Дебаг-панель: видна прямо в UI */}
        <div style={{ fontSize: 11, background: '#0d1117', padding: 8, borderRadius: 4, color: '#7ec8e3', fontFamily: 'monospace' }}>
          <div>🔍 <b>DEBUG</b></div>
          <div>editingId: <b>{editingId ?? 'null'}</b></div>
          <div>editingIndicator: <b>{editingIndicator ? `found (${editingIndicator.type})` : 'NOT FOUND'}</b></div>
          <div>store indicators ({indicators.length}):</div>
          {indicators.map(i => (
            <div key={i.id} style={{ paddingLeft: 8 }}>└ {i.type} | id: {i.id}</div>
          ))}
        </div>

        {!editingIndicator && (
          <>
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

            <div style={{ marginTop: 12, fontSize: 13 }}>
              Уже добавлены:
              {indicators.length === 0 && ' нет активных индикаторов'}
              {indicators.length > 0 && (
                <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                  {indicators.map((ind) => (
                    <li
                      key={ind.id}
                      style={{ fontSize: 12, cursor: ind.type === 'sma' ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (ind.type === 'sma') {
                          console.log(`[IndicatorsModal] clicking existing SMA id="${ind.id}"`);
                          setEditingId(ind.id);
                        }
                      }}
                    >
                      {ind.type.toUpperCase()} (id: {ind.id})
                      {ind.type === 'sma' && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: '#2962FF' }}>✎ настройки</span>
                      )}
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
            onClose={() => {
              console.log('[IndicatorsModal] SMAForm onClose called → resetting editingId');
              setEditingId(null);
            }}
          />
        )}
      </div>
    </div>
  );
};
