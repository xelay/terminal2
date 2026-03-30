import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { INDICATORS_REGISTRY, IndicatorMeta } from './registry';
import { SMAForm } from './SMAForm';
import { VolumeProfileForm } from './VolumeProfileForm';
import { RenkoForm } from './RenkoForm';

interface IndicatorsModalProps {
  onClose: () => void;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
}

const NEW_SMA_ID = '__new_sma__';
const NEW_VP_ID  = '__new_vp__';
const NEW_RK_ID  = '__new_rk__';

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({ onClose, candles }) => {
  const { indicators, addIndicator, removeIndicator } = useWorkspaceStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const isNewSMA = editingId === NEW_SMA_ID;
  const isNewVP  = editingId === NEW_VP_ID;
  const isNewRK  = editingId === NEW_RK_ID;
  const editingIndicator = editingId && !isNewSMA && !isNewVP && !isNewRK
    ? indicators.find(i => i.id === editingId)
    : undefined;

  const showSMAForm = isNewSMA || editingIndicator?.type === 'sma';
  const showVPForm  = isNewVP  || editingIndicator?.type === 'volume_profile';
  const showRKForm  = isNewRK  || editingIndicator?.type === 'renko';
  const showForm    = showSMAForm || showVPForm || showRKForm;

  const handleAdd = (meta: IndicatorMeta) => {
    if (meta.type === 'sma')            { setEditingId(NEW_SMA_ID); return; }
    if (meta.type === 'volume_profile') { setEditingId(NEW_VP_ID);  return; }
    if (meta.type === 'renko')          { setEditingId(NEW_RK_ID);  return; }
    if (meta.type === 'volume') addIndicator('volume', meta.defaultParams);
  };

  const formTitle = isNewSMA ? 'Добавить SMA'
    : isNewVP  ? 'Добавить Volume Profile'
    : isNewRK  ? 'Добавить Renko'
    : editingIndicator?.type === 'sma'            ? 'Настройки SMA'
    : editingIndicator?.type === 'volume_profile' ? 'Настройки Volume Profile'
    : 'Настройки Renko';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{
        width: 420, maxHeight: 580, background: '#1e222d', borderRadius: 8,
        padding: 16, color: '#d1d4dc', display: 'flex', flexDirection: 'column',
        gap: 16, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>
            {showForm ? formTitle : 'Индикаторы'}
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
            <div style={{ fontSize: 13, opacity: 0.8 }}>Добавить новый индикатор:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INDICATORS_REGISTRY.map(meta => (
                <button
                  key={meta.type}
                  onClick={() => handleAdd(meta)}
                  style={{
                    width: '100%', textAlign: 'left', background: '#131722',
                    borderRadius: 4, border: '1px solid #2b2b43',
                    padding: '8px 12px', color: '#fff', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14 }}>{meta.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{meta.description}</div>
                </button>
              ))}
            </div>

            {indicators.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <div style={{ opacity: 0.8, marginBottom: 6 }}>Уже добавлены:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {indicators.map(ind => (
                    <div key={ind.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 4, background: '#131722',
                    }}>
                      <span style={{ flex: 1, fontSize: 12 }}>
                        {ind.type === 'volume_profile' ? 'VOLUME PROFILE'
                          : ind.type === 'renko' ? 'RENKO'
                          : ind.type.toUpperCase()}
                        {ind.type === 'sma' && (
                          <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11 }}>period={ind.params.period ?? 20}</span>
                        )}
                        {ind.type === 'volume_profile' && (
                          <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11 }}>rows={ind.params.rows ?? 36}</span>
                        )}
                        {ind.type === 'renko' && (
                          <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11 }}>size={ind.params.blockSize ?? 'ATR'}</span>
                        )}
                      </span>
                      {(ind.type === 'sma' || ind.type === 'volume_profile' || ind.type === 'renko') && (
                        <button onClick={() => setEditingId(ind.id)} title="Настройки"
                          style={{
                            background: 'transparent', border: '1px solid #2b2b43',
                            borderRadius: 4, color: '#2962FF', cursor: 'pointer',
                            padding: '2px 8px', fontSize: 12, lineHeight: '18px',
                          }}
                        >⚙️</button>
                      )}
                      <button onClick={() => removeIndicator(ind.id)} title="Удалить"
                        style={{
                          background: 'transparent', border: '1px solid #ef5350',
                          borderRadius: 4, color: '#ef5350', cursor: 'pointer',
                          padding: '2px 8px', fontSize: 12, lineHeight: '18px',
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showSMAForm && <SMAForm indicatorId={isNewSMA ? undefined : editingIndicator?.id} onClose={() => setEditingId(null)} />}
        {showVPForm  && <VolumeProfileForm indicatorId={isNewVP ? undefined : editingIndicator?.id} onClose={() => setEditingId(null)} />}
        {showRKForm  && <RenkoForm indicatorId={isNewRK ? undefined : editingIndicator?.id} candles={candles} onClose={() => setEditingId(null)} />}
      </div>
    </div>
  );
};
