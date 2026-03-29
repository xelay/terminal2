import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type IndicatorType = 'sma' | 'volume';

export interface Indicator {
  id: string;
  type: IndicatorType;
  params: any;
}

interface WorkspaceState {
  exchange: string;
  symbol: string;
  timeframe: Timeframe;
  indicators: Indicator[];

  setSymbol: (exchange: string, symbol: string) => void;
  setTimeframe: (tf: Timeframe) => void;

  addIndicator: (type: IndicatorType, params: any) => void;
  updateIndicator: (id: string, params: any) => void;
  removeIndicator: (id: string) => void;
}

// кастомный storage: гость -> localStorage, авторизованный -> backend
const apiStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      return localStorage.getItem(name);
    }
    const res = await fetch('/api/user/workspace', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return JSON.stringify({ state: data });
    }
    return null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      localStorage.setItem(name, value);
      return;
    }
    const stateObj = JSON.parse(value).state;
    await fetch('/api/user/workspace', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(stateObj),
    });
  },

  removeItem: async (name: string): Promise<void> => {
    localStorage.removeItem(name);
  },
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      exchange: 'bybit',
      symbol: 'BTC/USDT',
      timeframe: '15m',
      indicators: [
        { id: 'vol_1', type: 'volume', params: {} },
        { id: 'sma_1', type: 'sma', params: { period: 20, color: '#2962FF' } },
      ],

      setSymbol: (exchange, symbol) => set({ exchange, symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),

      // Принимает опциональный id в params.id для детерминированного id индикатора
      addIndicator: (type, params) =>
        set((state) => {
          const id = params.id ?? `${type}_${Date.now()}`;
          const cleanParams = { ...params };
          delete cleanParams.id;
          return {
            indicators: [
              ...state.indicators,
              { id, type, params: cleanParams },
            ],
          };
        }),

      updateIndicator: (id, params) =>
        set((state) => ({
          indicators: state.indicators.map((ind) =>
            ind.id === id ? { ...ind, params: { ...ind.params, ...params } } : ind,
          ),
        })),

      removeIndicator: (id) =>
        set((state) => ({
          indicators: state.indicators.filter((ind) => ind.id !== id),
        })),
    }),
    {
      name: 'terminal-workspace',
      storage: createJSONStorage(() => apiStorage),
      partialize: (state) => ({
        exchange: state.exchange,
        symbol: state.symbol,
        timeframe: state.timeframe,
        indicators: state.indicators,
      }),
    },
  ),
);
