import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { trackLogin } from '../../lib/trackLogin';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';

function SuccessModal({ visible, message, onDismiss, t }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[
          styles.modalBox,
          { transform: [{ scale }], opacity },
        ]}
      >
        <View style={styles.modalIconCircle}>
          <MaterialIcons name="check" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.modalTitle}>{t('successTitle')}</Text>
        <Text style={styles.modalMessage}>{message}</Text>
        <TouchableOpacity
          style={styles.modalButton}
          activeOpacity={0.85}
          onPress={onDismiss}
        >
          <Text style={styles.modalButtonText}>{t('ok')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function AuthScreen({ onLogin }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [tab, setTab] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ visible: false, message: '' });
  const [forgotMode, setForgotMode] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const isSignIn = tab === 'signin';
  const isAndroid = Platform.OS === 'android';

  const handleSubmit = async () => {
    if (!email || !password) {
      return;
    }
    if (!isSignIn && password !== confirmPassword) {
      return;
    }
    setLoading(true);
    try {
      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        trackLogin();
        onLogin && onLogin();
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setSuccessModal({ visible: true, message: 'Check your email for confirmation!' });
      }
    } catch (err) {
      setSuccessModal({ visible: true, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
    } catch (err) {
      setSuccessModal({ visible: true, message: err.message });
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setSuccessModal({ visible: true, message: t('enterEmailFirst') });
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setSuccessModal({ visible: true, message: t('resetLinkSent') });
      setForgotMode(false);
    } catch (err) {
      setSuccessModal({ visible: true, message: err.message });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <Image
            source={require('../../../assets/logo2.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, isSignIn && styles.tabActive]}
            onPress={() => setTab('signin')}
          >
            <Text style={[styles.tabText, isSignIn && styles.tabTextActive]}>
              Sign in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isSignIn && styles.tabActive]}
            onPress={() => setTab('signup')}
          >
            <Text style={[styles.tabText, !isSignIn && styles.tabTextActive]}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isSignIn && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('fullName')}</Text>
              <TextInput
                style={styles.input}
                placeholder="your name"
                placeholderTextColor={colors.surfaceVariant}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              placeholder="Type your email"
              placeholderTextColor={colors.surfaceVariant}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {forgotMode && (
            <Text style={styles.forgotHint}>{t('forgotHint')}</Text>
          )}

          {!forgotMode && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('password')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Type your password"
                  placeholderTextColor={colors.surfaceVariant}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isSignIn && !forgotMode && (
            <TouchableOpacity style={styles.forgotRow} onPress={() => setForgotMode(true)}>
              <Text style={styles.forgotLink}>{t('forgotPassword')}</Text>
            </TouchableOpacity>
          )}

          {!isSignIn && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('confirmPassword')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Type your password"
                  placeholderTextColor={colors.surfaceVariant}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <MaterialIcons
                    name={showConfirm ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, (loading || sendingReset) && styles.submitDisabled]}
            onPress={forgotMode ? handleForgotPassword : handleSubmit}
            activeOpacity={0.85}
            disabled={loading || sendingReset}
          >
            <Text style={styles.submitText}>
              {forgotMode
                ? (sendingReset ? t('pleaseWait') : t('sendResetLink'))
                : (loading ? t('pleaseWait') : isSignIn ? t('signIn') : t('joinNow'))}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            Or sign {isSignIn ? 'in' : 'up'} with
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          {isAndroid ? (
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.85}
              onPress={() => handleSocialAuth('google')}
            >
              <MaterialIcons name="g-translate" size={16} color={colors.onSurface} />
              <Text style={styles.socialText}>{t('google')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.85}
              onPress={() => handleSocialAuth('apple')}
            >
              <MaterialIcons name="apple" size={16} color={colors.onSurface} />
              <Text style={styles.socialText}>{t('apple')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          {forgotMode ? (
            <Text style={styles.footerText}>
              <Text
                style={styles.footerLink}
                onPress={() => setForgotMode(false)}
              >
                {t('backToSignIn')}
              </Text>
            </Text>
          ) : (
            <Text style={styles.footerText}>
              {isSignIn ? (
                <>
                  {t('dontHaveAccount')}{' '}
                  <Text
                    style={styles.footerLink}
                    onPress={() => setTab('signup')}
                  >
                    {t('signUp')}
                  </Text>
                </>
              ) : (
                <>
                  {t('alreadyHaveAccount')}{' '}
                  <Text
                    style={styles.footerLink}
                    onPress={() => setTab('signin')}
                  >
                    {t('signIn')}
                  </Text>
                </>
              )}
            </Text>
          )}
          <Text style={styles.termsText}>
            {t('termsAgree')}{' '}
            <Text style={styles.footerLink}>{t('termsOfService')}</Text>
          </Text>
        </View>
      </ScrollView>

      <SuccessModal
        visible={successModal.visible}
        message={successModal.message}
        onDismiss={() => setSuccessModal({ visible: false, message: '' })}
        t={t}
      />
    </KeyboardAvoidingView>
  );
}

function getStyles(colors, FONTS) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  logoImage: {
    width: 120,
    height: 48,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingBottom: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  forgotHint: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.primary,
    marginLeft: 4,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
    marginTop: -6,
  },
  forgotLink: {
    fontFamily: FONTS.labelMd,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginLeft: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
  },
  passwordInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  eyeButton: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  submitButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: FONTS.headlineMd,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceVariant,
  },
  dividerText: {
    fontFamily: FONTS.labelMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 4,
  },
  socialText: {
    fontFamily: FONTS.labelMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  termsText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalBox: {
    width: 280,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.headlineMd,
    fontSize: 18,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    height: 40,
    paddingHorizontal: 32,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontFamily: FONTS.headlineMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
}
