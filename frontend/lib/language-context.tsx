"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type AppLanguage, translations } from './i18n';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('app_language');
      if (stored === 'en' || stored === 'ar') {
        return stored;
      }
    }
    return 'en';
  });

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[language] as Record<string, string>;
      return dict[key] || (translations.en as Record<string, string>)[key] || key;
    },
    [language]
  );

  useEffect(() => {
    localStorage.setItem('app_language', language);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;

    if (isRTL) {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
  }, [language, dir, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
