import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from './src/screens/splash/SplashScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import AuthScreen from './src/screens/auth/SignUpScreen';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import { COLORS } from './src/constants/theme';
import { supabase } from './src/lib/supabase';
import { LocaleProvider } from './src/i18n/LocaleContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import CallManager from './src/components/CallManager';
import Constants from 'expo-constants';
import * as Sentry from 'sentry-expo';

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  enableInExpoDevelopment: true,
  debug: false,
});

const ONBOARDING_KEY = '@netvibe_onboarding_completed';

function App() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });

  const [phase, setPhase] = useState('loading');
  const [targetScreen, setTargetScreen] = useState(null);

  throw new Error('sentry test'); // TEMP — Sentry test, sonra silinir

  useEffect(() => {
    async function init() {
      try {
        const [completed, sessionResult] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          supabase.auth.getSession(),
        ]);
        const hasSession = !!sessionResult?.data?.session;
        if (completed === 'true' && hasSession) {
          setTargetScreen('dashboard');
        } else if (completed === 'true') {
          setTargetScreen('login');
        } else {
          setTargetScreen('onboarding');
        }
        setPhase('splash');
      } catch {
        setTargetScreen('onboarding');
        setPhase('splash');
      }
    }
    if (fontsLoaded) {
      init();
    }
  }, [fontsLoaded]);

  const handleSplashReady = useCallback(() => {
    setPhase(targetScreen);
  }, [targetScreen]);

  const handleOnboardingComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    setPhase('login');
  }, []);

  const handleLogin = useCallback(() => {
    setPhase('dashboard');
  }, []);

  const handleSignOut = useCallback(() => {
    Sentry.setUser(null);
    setPhase('login');
  }, []);

  if (!fontsLoaded || phase === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (phase === 'splash') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SplashScreen onReady={handleSplashReady} />
      </View>
    );
  }

  return (
    <LocaleProvider>
      <ThemeProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {phase === 'onboarding' ? (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        ) : phase === 'dashboard' ? (
          <>
            <DashboardScreen onSignOut={handleSignOut} />
            <CallManager />
          </>
        ) : (
          <AuthScreen onLogin={handleLogin} />
        )}
      </View>
      </ThemeProvider>
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Sentry.wrap(App);
