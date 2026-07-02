import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

function getInitialDark(): boolean {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return false;
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: getInitialDark(),

  toggle: () =>
    set((state) => {
      const next = !state.isDark;
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      document.documentElement.classList.toggle('dark', next);
      return { isDark: next };
    }),
}));
