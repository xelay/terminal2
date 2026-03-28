// src/features/chart/indicators/registry.ts
import { SMAForm } from './SMAForm';

export type IndicatorType = 'sma' | 'volume';

export interface IndicatorMeta {
  type: IndicatorType;
  label: string;
  description: string;
  defaultParams: any;
}

export const INDICATORS_REGISTRY: IndicatorMeta[] = [
  {
    type: 'sma',
    label: 'Simple Moving Average (SMA)',
    description: 'Скользящая средняя по цене закрытия.',
    defaultParams: { period: 20, color: '#2962FF' },
  },
  {
    type: 'volume',
    label: 'Volume',
    description: 'Гистограмма объема под графиком.',
    defaultParams: {},
  },
];
