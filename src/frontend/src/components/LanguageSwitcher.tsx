import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useCallback, useEffect } from 'react';

const LANGUAGES = [
  { code: 'id', label: 'ID' },
  { code: 'en', label: 'EN' },
];

const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLng = i18n.language?.startsWith('en') ? 'en' : 'id';

  const toggleLanguage = useCallback(() => {
    const next = currentLng === 'id' ? 'en' : 'id';
    i18n.changeLanguage(next);
    try {
      localStorage.setItem('i18nextLng', next);
    } catch { /* ignore */ }
    const isRtl = RTL_LANGS.includes(next);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  }, [currentLng, i18n]);

  useEffect(() => {
    const isRtl = RTL_LANGS.includes(i18n.language);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={toggleLanguage}
      title={currentLng === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
      aria-label={currentLng === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}
    >
      <Languages size={15} />
      <span style={{ textTransform: 'uppercase' }}>{currentLng}</span>
    </button>
  );
}
