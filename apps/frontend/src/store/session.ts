import { create } from 'zustand';

const TOKEN_KEY = 'jwt_token';

interface SessionState {
  token: string | null;
  user: { id: string } | null;
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isLoggedIn: !!localStorage.getItem(TOKEN_KEY),

  login: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isLoggedIn: false });
  },
}));
