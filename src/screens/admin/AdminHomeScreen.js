import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';
import AdminJobsScreen from '../vacancies/AdminJobsScreen';

const MODULES = [
  {
    key: 'jobs',
    icon: 'work',
    titleKey: 'jobApprovals',
    descKey: 'adminJobsDesc',
  },
  {
    key: 'users',
    icon: 'group',
    titleKey: 'users',
    descKey: 'adminUsersDesc',
    soon: true,
  },
  {
    key: 'reports',
    icon: 'flag',
    titleKey: 'reports',
    descKey: 'adminReportsDesc',
    soon: true,
  },
];

export default function AdminHomeScreen({ onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [section, setSection] = useState(null);
  const [stats, setStats] = useState({ pending: 0, active: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('status');
      if (error) throw error;
      const s = { pending: 0, active: 0, rejected: 0 };
      (data || []).forEach(j => {
        if (s[j.status] != null) s[j.status]++;
      });
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (section === 'jobs') {
    return <AdminJobsScreen onBack={() => setSection(null)} />;
  }

  const statCards = [
    { key: 'pending', icon: 'hourglass-top', color: colors.tertiary, value: stats.pending },
    { key: 'active', icon: 'check-circle', color: colors.secondary, value: stats.active },
    { key: 'rejected', icon: 'cancel', color: colors.error, value: stats.rejected },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>{t('adminPanel')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrap}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.statsRow}>
              {statCards.map(card => (
                <View key={card.key} style={[styles.statCard, { backgroundColor: colors.surfaceContainerLow }]}>
                  <View style={[styles.statIcon, { backgroundColor: card.color + '22' }]}>
                    <MaterialIcons name={card.icon} size={20} color={card.color} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.onSurface }]}>{card.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
                    {t(`job${card.key.charAt(0).toUpperCase() + card.key.slice(1)}`)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>{t('adminModules')}</Text>

          <View style={styles.moduleList}>
            {MODULES.map(module => (
              <TouchableOpacity
                key={module.key}
                style={[styles.moduleCard, { backgroundColor: colors.surfaceContainerLow }]}
                onPress={() => setSection(module.key)}
                disabled={!!module.soon}
              >
                <View style={[styles.moduleIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
                  <MaterialIcons name={module.icon} size={24} color={colors.primaryContainer} />
                </View>
                <View style={styles.moduleInfo}>
                  <Text style={[styles.moduleTitle, { color: colors.onSurface }]}>{t(module.titleKey)}</Text>
                  <Text style={[styles.moduleDesc, { color: colors.onSurfaceVariant }]}>{t(module.descKey)}</Text>
                </View>
                {module.soon ? (
                  <View style={[styles.soonBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.soonText, { color: colors.onSurfaceVariant }]}>{t('comingSoon')}</Text>
                  </View>
                ) : (
                  <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backButton: { padding: 6 },
    topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 120 },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center' },
    center: { paddingVertical: 48, justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    statCard: {
      flex: 1, borderRadius: 14, padding: 14,
      alignItems: 'center', gap: 6,
    },
    statIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontFamily: FONTS.headlineMd, fontSize: 22, fontWeight: '700' },
    statLabel: { fontFamily: FONTS.labelMd, fontSize: 11, textAlign: 'center' },
    sectionTitle: {
      fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '600',
      letterSpacing: 1.2, marginBottom: 12,
    },
    moduleList: { gap: 12 },
    moduleCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderRadius: 14, padding: 16,
    },
    moduleIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    moduleInfo: { flex: 1, minWidth: 0 },
    moduleTitle: { fontFamily: FONTS.bodyLg, fontSize: 15, fontWeight: '700' },
    moduleDesc: { fontFamily: FONTS.bodyMd, fontSize: 12, marginTop: 2 },
    soonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    soonText: { fontFamily: FONTS.labelMd, fontSize: 10, textTransform: 'uppercase' },
  });
}
