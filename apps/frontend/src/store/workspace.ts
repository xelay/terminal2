import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type Theme = 'dark' | 'light';

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
  theme: Theme;

  setSymbol: (exchange: string, symbol: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setTheme: (theme: Theme) => void;
  addIndicator: (type: IndicatorType, params: any) => void;
  updateIndicator: (id: string, params: any) => void;
  removeIndicator: (id: string) => void;
  clearIndicators: () => void;
}

const apiStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return localStorage.getItem(name);
    try {
      const res = await fetch('/api/user/workspace', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.stringify({ state: data });
      }
    } catch {}
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) { localStorage.setItem(name, value); return; }
    try {
      const stateObj = JSON.parse(value).state;
      await fetch('/api/user/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(stateObj),
      });
    } catch {}
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
      indicators: [],
      theme: 'dark',

      setSymbol: (exchange, symbol) => set({ exchange, symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setTheme: (theme) => set({ theme }),

      addIndicator: (type, params) =>
        set((state) => {
          const id = `${type}_${Date.now()}`;
          if (state.indicators.find((i) => i.id === id)) return state;
          return { indicators: [...state.indicators, { id, type, params }] };
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

      clearIndicators: () => set({ indicators: [] }),
    }),
    {
      name: 'terminal-workspace',
      storage: createJSONStorage(() => apiStorage),
      partialize: (state) => ({
        exchange: state.exchange,
        symbol: state.symbol,
        timeframe: state.timeframe,
        indicators: state.indicators,
        theme: state.theme,
      }),
    },
  ),
);
