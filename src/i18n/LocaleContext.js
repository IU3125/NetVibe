import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import locales from './locales';

const STORAGE_KEY = '@netvibe_language';
const FALLBACK_LANG = 'en';

const LocaleContext = createContext();

export function LocaleProvider({ children }) {
  const [lang, setLang] = useState(FALLBACK_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && locales[saved]) setLang(saved);
    });
  }, []);

  const changeLanguage = (newLang) => {
    if (locales[newLang]) {
      setLang(newLang);
      AsyncStorage.setItem(STORAGE_KEY, newLang);
    }
  };

  const t = (key) => locales[lang]?.[key] ?? locales[FALLBACK_LANG]?.[key] ?? key;

  return (
    <LocaleContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
