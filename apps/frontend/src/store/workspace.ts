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

const apiStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const token = localStorage.getItem('jwt_token');
    console.log(`[workspace:storage] getItem key="${name}" token=${token ? 'present' : 'absent'}`);
    if (!token) {
      const raw = localStorage.getItem(name);
      console.log(`[workspace:storage] → localStorage result:`, raw ? JSON.parse(raw) : null);
      return raw;
    }
    try {
      const res = await fetch('/api/user/workspace', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`[workspace:storage] → /api/user/workspace status=${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`[workspace:storage] → backend data:`, data);
        return JSON.stringify({ state: data });
      }
    } catch (e) {
      console.error(`[workspace:storage] → fetch error:`, e);
    }
    return null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const token = localStorage.getItem('jwt_token');
    const stateObj = JSON.parse(value).state;
    console.log(`[workspace:storage] setItem key="${name}" token=${token ? 'present' : 'absent'} state:`, stateObj);
    if (!token) {
      localStorage.setItem(name, value);
      return;
    }
    try {
      const res = await fetch('/api/user/workspace', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(stateObj),
      });
      console.log(`[workspace:storage] → PUT /api/user/workspace status=${res.status}`);
    } catch (e) {
      console.error(`[workspace:storage] → PUT error:`, e);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    console.log(`[workspace:storage] removeItem key="${name}"`);
    localStorage.removeItem(name);
  },
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      exchange: 'bybit',
      symbol: 'BTC/USDT',
      timeframe: '15m',
      indicators: [
        { id: 'vol_1', type: 'volume', params: {} },
        { id: 'sma_1', type: 'sma', params: { period: 20, color: '#2962FF' } },
      ],

      setSymbol: (exchange, symbol) => {
        console.log(`[workspace] setSymbol exchange=${exchange} symbol=${symbol}`);
        set({ exchange, symbol });
      },

      setTimeframe: (timeframe) => {
        console.log(`[workspace] setTimeframe tf=${timeframe}`);
        set({ timeframe });
      },

      addIndicator: (type, params) =>
        set((state) => {
          const id = params.id ?? `${type}_${Date.now()}`;
          const cleanParams = { ...params };
          delete cleanParams.id;
          console.log(`[workspace] addIndicator type=${type} id=${id} params:`, cleanParams);
          console.log(`[workspace] indicators before add:`, state.indicators.map(i => i.id));
          const next = [
            ...state.indicators,
            { id, type, params: cleanParams },
          ];
          console.log(`[workspace] indicators after add:`, next.map(i => i.id));
          return { indicators: next };
        }),

      updateIndicator: (id, params) =>
        set((state) => {
          console.log(`[workspace] updateIndicator id=${id} params:`, params);
          return {
            indicators: state.indicators.map((ind) =>
              ind.id === id ? { ...ind, params: { ...ind.params, ...params } } : ind,
            ),
          };
        }),

      removeIndicator: (id) =>
        set((state) => {
          console.log(`[workspace] removeIndicator id=${id}`);
          return {
            indicators: state.indicators.filter((ind) => ind.id !== id),
          };
        }),
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
      onRehydrateStorage: () => {
        console.log('[workspace:persist] ⏳ hydration started...');
        return (state, error) => {
          if (error) {
            console.error('[workspace:persist] ❌ hydration error:', error);
          } else {
            console.log('[workspace:persist] ✅ hydration complete. State:', {
              exchange: state?.exchange,
              symbol: state?.symbol,
              timeframe: state?.timeframe,
              indicators: state?.indicators?.map(i => ({ id: i.id, type: i.type })),
            });
          }
        };
      },
    },
  ),
);
