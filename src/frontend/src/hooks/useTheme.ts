import { useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';

export function useTheme(): { isDark: boolean; toggle: () => void } {
  const { isDark, toggle } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return { isDark, toggle };
}
