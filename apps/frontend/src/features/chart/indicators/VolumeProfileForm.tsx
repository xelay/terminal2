import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';

interface Props {
  indicatorId?: string;
  onClose: () => void;
}

export const VolumeProfileForm: React.FC<Props> = ({ indicatorId, onClose }) => {
  const { addIndicator, updateIndicator, indicators } = useWorkspaceStore();
  const existing = indicatorId ? indicators.find(i => i.id === indicatorId) : undefined;

  const [rows,    setRows]    = useState<number>(existing?.params.rows    ?? 36);
  const [color,   setColor]   = useState<string>(existing?.params.color   ?? '#3b82f6');
  const [opacity, setOpacity] = useState<number>(existing?.params.opacity ?? 0.35);

  const handleSave = () => {
    if (existing) {
      updateIndicator(existing.id, { rows, color, opacity });
    } else {
      addIndicator('volume_profile', { rows, color, opacity });
    }
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    background: '#131722', border: '1px solid #2b2b43', borderRadius: 4,
    color: '#d1d4dc', padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={labelStyle}>Количество строк</div>
        <input
          type="number" min={4} max={200} value={rows}
          onChange={e => setRows(Number(e.target.value))}
          style={inputStyle}
        />
      </div>
      <div>
        <div style={labelStyle}>Цвет</div>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          style={{ ...inputStyle, padding: 2, height: 36, cursor: 'pointer' }} />
      </div>
      <div>
        <div style={labelStyle}>Прозрачность ({Math.round(opacity * 100)}%)</div>
        <input
          type="range" min={5} max={100} value={Math.round(opacity * 100)}
          onChange={e => setOpacity(Number(e.target.value) / 100)}
          style={{ width: '100%' }}
        />
      </div>
      <button
        onClick={handleSave}
        style={{
          background: '#2962FF', color: '#fff', border: 'none',
          borderRadius: 4, padding: '8px 0', cursor: 'pointer', fontSize: 14,
        }}
      >
        {existing ? 'Сохранить' : 'Добавить'}
      </button>
    </div>
  );
};
