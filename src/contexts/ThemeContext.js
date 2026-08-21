import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../constants/theme';

const STORAGE_KEY = '@netvibe_theme';

const getSystemTheme = () => {
  try {
    const s = Appearance.getColorScheme();
    return s === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
};

const defaultColors = darkColors;

const ThemeContext = createContext({
  mode: 'dark',
  colors: defaultColors,
  changeTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setMode(saved);
      }
    });
  }, []);

  const resolvedTheme = mode === 'system' ? getSystemTheme() : mode;
  const colors = resolvedTheme === 'light' ? lightColors : darkColors;

  const changeTheme = (newMode) => {
    setMode(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  };

  const value = useMemo(() => ({ mode, colors, changeTheme }), [mode, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
