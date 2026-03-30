import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type Theme = 'dark' | 'light';

export type IndicatorType = 'sma' | 'volume' | 'volume_profile' | 'renko';

export interface Indicator {
  id: string;
  type: IndicatorType;
  params: any;
}

export interface FavoriteSymbol {
  exchange: string;
  symbol: string;
}

// Если биржа отключена — заменяем на этот словарь
const EXCHANGE_MIGRATION: Record<string, string> = {
  moex: 'tinkoff',
};

function migrateExchange(ex: string): string {
  return EXCHANGE_MIGRATION[ex] ?? ex;
}

interface WorkspaceState {
  exchange: string;
  symbol: string;
  timeframe: Timeframe;
  indicators: Indicator[];
  theme: Theme;
  favorites: FavoriteSymbol[];

  setSymbol: (exchange: string, symbol: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setTheme: (theme: Theme) => void;
  addIndicator: (type: IndicatorType, params: any) => void;
  updateIndicator: (id: string, params: any) => void;
  removeIndicator: (id: string) => void;
  clearIndicators: () => void;
  toggleFavorite: (exchange: string, symbol: string) => void;
  isFavorite: (exchange: string, symbol: string) => boolean;
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
    (set, get) => ({
      exchange: 'bybit',
      symbol: 'BTC/USDT',
      timeframe: '15m',
      indicators: [],
      theme: 'dark',
      favorites: [],

      setSymbol: (exchange, symbol) => set({ exchange: migrateExchange(exchange), symbol }),
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

      toggleFavorite: (exchange, symbol) =>
        set((state) => {
          const ex = migrateExchange(exchange);
          const exists = state.favorites.some(
            f => f.exchange === ex && f.symbol === symbol
          );
          const favorites = exists
            ? state.favorites.filter(f => !(f.exchange === ex && f.symbol === symbol))
            : [...state.favorites, { exchange: ex, symbol }];
          return { favorites };
        }),

      isFavorite: (exchange, symbol) =>
        get().favorites.some(f => f.exchange === migrateExchange(exchange) && f.symbol === symbol),
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
        favorites: state.favorites,
      }),
      // Миграция при определении из персистентного хранилища
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const migratedExchange = migrateExchange(state.exchange);
        const migratedFavorites = state.favorites.map(f => ({
          ...f,
          exchange: migrateExchange(f.exchange),
        }));
        if (migratedExchange !== state.exchange || migratedFavorites.some((f, i) => f.exchange !== state.favorites[i]?.exchange)) {
          state.exchange = migratedExchange;
          state.favorites = migratedFavorites;
        }
      },
    },
  ),
);
