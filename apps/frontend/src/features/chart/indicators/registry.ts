import { SMAForm } from './SMAForm';

export type IndicatorType = 'sma' | 'volume' | 'volume_profile' | 'renko';

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
    description: 'Гистограмма объёма под графиком.',
    defaultParams: {},
  },
  {
    type: 'volume_profile',
    label: 'Volume Profile',
    description: 'Горизонтальный профиль объёмов по видимому диапазону, прижат к правому краю.',
    defaultParams: { rows: 36, color: '#3b82f6', opacity: 0.35 },
  },
  {
    type: 'renko',
    label: 'Renko',
    description: 'Блоки Renko поверх свечного графика — ширина по времени, высота по заданному размеру.',
    defaultParams: { blockSize: null, source: 'close', bullColor: '#26a69a', bearColor: '#ef5350', opacity: 0.3 },
  },
];
