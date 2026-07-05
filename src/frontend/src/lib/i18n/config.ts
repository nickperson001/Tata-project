import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id from './locales/id.json';
import en from './locales/en.json';

function getInitialLng(): string {
  try {
    return localStorage.getItem('i18nextLng') || 'id';
  } catch {
    return 'id';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: getInitialLng(),
  fallbackLng: 'id',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
