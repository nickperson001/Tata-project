import { create } from 'zustand';
import { api } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  role: string | null;
  isLoading: boolean;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  email: null,
  role: null,
  isLoading: true,

  checkSession: async () => {
    try {
      const res = await api.get<{ authenticated: boolean; email: string; role: string }>('/api/admin/me');
      if (res.authenticated) {
        set({ isAuthenticated: true, email: res.email, role: res.role, isLoading: false });
      } else {
        set({ isAuthenticated: false, email: null, role: null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, email: null, role: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const res = await api.post<{ success: boolean; email: string; role: string }>('/admin/login', { email, password });
    set({ isAuthenticated: true, email: res.email, role: res.role });
  },

  logout: async () => {
    try {
      await api.post('/admin/logout');
    } catch {
      // ignore
    }
    set({ isAuthenticated: false, email: null, role: null });
  },
}));
