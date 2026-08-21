import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const themes = [
  { key: 'dark', label: 'nocturnal', icon: 'weather-night' },
  { key: 'light', label: 'luminous', icon: 'weather-sunny' },
  { key: 'system', label: 'system', icon: 'theme-light-dark' },
];

const languages = [
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
  { key: 'az', label: 'Azərbaycan dili' },
  { key: 'ru', label: 'Русский' },
  { key: 'de', label: 'Deutsch' },
  { key: 'fr', label: 'Français' },
];

export default function SettingsScreen({ onSignOut, onBack }) {
  const { t, lang, changeLanguage } = useLocale();
  const { colors, mode, changeTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [savingVis, setSavingVis] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [subscreen, setSubscreen] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [lastSignIn, setLastSignIn] = useState(null);
  const [lastLoginIp, setLastLoginIp] = useState('');
  const [lastLoginLocation, setLastLoginLocation] = useState('');
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    loadUserData();
    loadVisibility();
    loadBlockedUsers();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');
      setLastSignIn(user.last_sign_in_at || null);

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('login_history')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoff);

      const { data: logins } = await supabase
        .from('login_history')
        .select('ip_address, city, country, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (logins?.length) {
        const l = logins[0];
        setLastSignIn(l.created_at);
        setLastLoginIp(l.ip_address || '');
        const parts = [l.city, l.country].filter(Boolean);
        setLastLoginLocation(parts.join(', '));
      } else {
        setLastSignIn(null);
        setLastLoginIp('');
        setLastLoginLocation('');
      }
    } catch {}
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('error'), 'Fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('error'), 'Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert(t('successTitle'), 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSubscreen(null);
    } catch (err) {
      Alert.alert(t('error'), err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const loadVisibility = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('visibility')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.visibility) setVisibility(data.visibility);
    } catch {}
  };

  const loadBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      const ids = data?.map(b => b.blocked_id) || [];
      if (ids.length === 0) { setBlockedUsers([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', ids);
      setBlockedUsers(profiles || []);
    } catch {} finally {
      setLoadingBlocked(false);
    }
  };

  const toggleVisibility = async () => {
    const next = visibility === 'public' ? 'friends' : 'public';
    setSavingVis(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('profiles')
        .update({ visibility: next })
        .eq('id', user.id);
      if (error) throw error;
      setVisibility(next);
    } catch {
      Alert.alert(t('error'), 'Failed to update visibility');
    } finally {
      setSavingVis(false);
    }
  };

  const unblockUser = async (blockedId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
      setBlockedUsers(prev => prev.filter(b => b.id !== blockedId));
    } catch {
      Alert.alert(t('error'), 'Failed to unblock user');
    }
  };

  const clearLoginHistory = async () => {
    Alert.alert('Clear login history?', 'This will remove all saved login records.', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearingHistory(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('login_history').delete().eq('user_id', user.id);
            setLastSignIn(null);
            setLastLoginIp('');
            setLastLoginLocation('');
          } catch {} finally {
            setClearingHistory(false);
          }
        },
      },
    ]);
  };

  if (subscreen === 'password') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setSubscreen(null)} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.onBackground }]}>{t('passwordSettings')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>Change your password</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20', padding: 16, gap: 16 }]}>
            <TextInput
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              placeholder="Current password"
              placeholderTextColor={colors.outlineVariant}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              placeholder="New password"
              placeholderTextColor={colors.outlineVariant}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              placeholder="Confirm new password"
              placeholderTextColor={colors.outlineVariant}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={changePassword}
              disabled={changingPassword}
            >
              <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
                {changingPassword ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (subscreen === 'security') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setSubscreen(null)} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.onBackground }]}>{t('securityLogins')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>Recent login activity</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20', padding: 16 }]}>
            {lastSignIn ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MaterialIcons name="history" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Last sign-in</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.onSurfaceVariant }]}>
                    {new Date(lastSignIn).toLocaleString()}
                  </Text>
                  {lastLoginIp ? (
                    <Text style={[styles.settingSubtitle, { color: colors.onSurfaceVariant, marginTop: 4 }]}>
                      IP: {lastLoginIp}{lastLoginLocation ? ` · ${lastLoginLocation}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.settingSubtitle, { color: colors.onSurfaceVariant }]}>No login records</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: colors.error + '33', backgroundColor: colors.error + '0D', marginTop: 16 }]}
            onPress={clearLoginHistory}
            disabled={clearingHistory}
          >
            <Text style={[styles.logoutText, { color: colors.error }]}>
              {clearingHistory ? t('saving') : 'Clear login history'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (showBlockedList) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setShowBlockedList(false)} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        {loadingBlocked ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.onSurfaceVariant }}>{t('noBlockedUsers')}</Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={[styles.settingRow, { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, marginBottom: 8, borderBottomWidth: 0, padding: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
                  <View>
                    <Text style={{ color: colors.onSurface, fontFamily: FONTS.bodyMd, fontSize: 14 }}>{item.full_name || item.username || item.id}</Text>
                    {item.username && <Text style={{ color: colors.onSurfaceVariant, fontFamily: FONTS.labelMd, fontSize: 11 }}>@{item.username}</Text>}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => unblockUser(item.id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.error + '33' }}
                >
                  <Text style={{ color: colors.error, fontSize: 12 }}>{t('unblock')}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.onBackground }]}>{t('settings')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>{t('manageAccount')}</Text>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('emailAddress')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20' }]}>
            <View style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="mail" size={22} color={colors.onSurfaceVariant} />
                <View style={styles.settingTextBlock}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('emailAddress')}</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.onSurfaceVariant }]}>{userEmail || t('loading')}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]} onPress={() => setSubscreen('password')}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="lock" size={22} color={colors.onSurfaceVariant} />
                <View style={styles.settingTextBlock}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('passwordSettings')}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]} onPress={() => setSubscreen('security')}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="security" size={22} color={colors.onSurfaceVariant} />
                <View style={styles.settingTextBlock}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('securityLogins')}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('pushNotifications')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20' }]}>
            <View style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="notifications-active" size={22} color={colors.onSurfaceVariant} />
                <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('pushNotifications')}</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="alternate-email" size={22} color={colors.onSurfaceVariant} />
                <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('emailNotifications')}</Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('profileVisibility')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20' }]}>
            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]} onPress={toggleVisibility} disabled={savingVis}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="visibility" size={22} color={colors.onSurfaceVariant} />
                <View style={styles.settingTextBlock}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('profileVisibility')}</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.secondary }]}>
                    {savingVis ? t('saving') : visibility === 'public' ? t('public') : t('friends')}
                  </Text>
                </View>
              </View>
              <MaterialIcons name={visibility === 'public' ? 'public' : 'people'} size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.outlineVariant + '20' }]} onPress={() => { loadBlockedUsers(); setShowBlockedList(true); }}>
              <View style={styles.settingRowLeft}>
                <MaterialIcons name="block" size={22} color={colors.onSurfaceVariant} />
                <View style={styles.settingTextBlock}>
                  <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{t('blockedUsers')}</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.onSurfaceVariant }]}>{blockedUsers.length} {t('users')}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('language')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20' }]}>
            {languages.map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.settingRow, i === languages.length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: colors.outlineVariant + '20' }]}
                onPress={() => changeLanguage(item.key)}
              >
                <Text style={[styles.settingTitle, lang === item.key && { color: colors.primary }, { color: colors.onSurface }]}>
                  {item.label}
                </Text>
                {lang === item.key && (
                  <MaterialIcons name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Theme */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('appTheme')}</Text>
          <View style={[styles.themeCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '20' }]}>
            <View style={styles.themeGrid}>
              {themes.map((th) => (
                <TouchableOpacity
                  key={th.key}
                  style={[
                    styles.themeOption,
                    { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
                    mode === th.key && { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.primary },
                  ]}
                  onPress={() => changeTheme(th.key)}
                >
                  <View
                    style={[
                      styles.themePreview,
                      th.key === 'dark' && styles.themePreviewDark,
                      th.key === 'light' && styles.themePreviewLight,
                      th.key === 'system' && styles.themePreviewSystem,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={th.icon}
                      size={20}
                      color={mode === th.key ? colors.primary : colors.onSurfaceVariant}
                    />
                  </View>
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: mode === th.key ? colors.onSurface : colors.onSurfaceVariant },
                    ]}
                  >
                    {t(th.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <TouchableOpacity style={[styles.logoutButton, { borderColor: colors.error + '33', backgroundColor: colors.error + '0D' }]} onPress={onSignOut}>
            <Text style={[styles.logoutText, { color: colors.error }]}>{t('logout')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton}>
            <Text style={[styles.deleteText, { color: colors.onSurfaceVariant }]}>{t('deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
  },
  backButton: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  header: { marginTop: 24, marginBottom: 32 },
  headerTitle: { fontFamily: FONTS.headlineLg, fontSize: 24, fontWeight: '700' },
  headerSubtitle: { fontFamily: FONTS.bodyMd, fontSize: 13, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '500', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 4, marginBottom: 12 },
  card: { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  settingTextBlock: { flex: 1 },
  settingTitle: { fontFamily: FONTS.bodyLg, fontSize: 14, fontWeight: '400' },
  settingSubtitle: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '500', marginTop: 2 },
  themeCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  themeGrid: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 2 },
  themePreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  themePreviewDark: { backgroundColor: '#131313', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  themePreviewLight: { backgroundColor: '#fdfcff' },
  themePreviewSystem: { backgroundColor: '#1e1b4b' },
  themeLabel: { fontFamily: FONTS.labelMd, fontSize: 11 },
  dangerZone: { paddingTop: 16 },
  logoutButton: { width: '100%', paddingVertical: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  logoutText: { fontFamily: FONTS.bodyLg, fontSize: 14 },
  deleteButton: { width: '100%', paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  deleteText: { fontFamily: FONTS.labelMd, fontSize: 11 },
  input: { fontFamily: FONTS.bodyMd, fontSize: 14, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  saveButton: { height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { fontFamily: FONTS.labelMd, fontSize: 13, fontWeight: '700' },
});
