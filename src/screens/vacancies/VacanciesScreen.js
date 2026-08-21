import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, useWindowDimensions, Platform, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';
import { scoreJob, rankJobs } from '../../lib/jobRecommendations';

const CATEGORIES = [
  { key: 'services', label: 'Services', icon: 'headphones' },
  { key: 'education', label: 'Education', icon: 'menu-book' },
  { key: 'buysell', label: 'Buy & Sell', icon: 'shopping-basket' },
  { key: 'sports', label: 'Sports', icon: 'sports-soccer' },
  { key: 'arts', label: 'Arts', icon: 'palette' },
  { key: 'it', label: 'IT', icon: 'devices' },
  { key: 'work', label: 'Work', icon: 'work' },
  { key: 'technology', label: 'Technology', icon: 'biotech' },
];

const TYPE_ICONS = {
  'Full-Time': 'badge',
  'Part-Time': 'schedule',
  'Contract': 'description',
  'Internship': 'school',
};

export default function VacanciesScreen({ onViewJob, onPostJob, onAdminJobs }) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 600) - 32;
  const catSize = (contentWidth - 36) / 4;

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('arts');
  const [jobs, setJobs] = useState([]);
  const [appliedIds, setAppliedIds] = useState({});
  const [savedIds, setSavedIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cvData, setCvData] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { data: rows, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')
        .or(`apply_before.is.null,apply_before.gte.${today}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJobs(rows || []);

      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(!!prof?.is_admin);

        const { data: cv } = await supabase
          .from('cv_data')
          .select('skills, desired_roles, years_experience, location, salary_expectation')
          .eq('user_id', user.id)
          .maybeSingle();
        setCvData(cv || null);

        const { data: apps } = await supabase
          .from('job_applications')
          .select('job_id')
          .eq('user_id', user.id);
        const appMap = {};
        (apps || []).forEach(a => { appMap[a.job_id] = true; });
        setAppliedIds(appMap);

        const { data: saved } = await supabase
          .from('saved_jobs')
          .select('job_id')
          .eq('user_id', user.id);
        const svMap = {};
        (saved || []).forEach(s => { svMap[s.job_id] = true; });
        setSavedIds(svMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (activeCategory) list = list.filter(j => j.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q)
      );
    }
    if (cvData) {
      list = rankJobs(list, cvData);
    }
    return list;
  }, [jobs, query, activeCategory, cvData]);

  const formatSalary = (job) => {
    const cur = job.currency || 'USD';
    const fmt = (n) => n != null ? n.toLocaleString() : '';
    const range = job.salary_min != null && job.salary_max != null
      ? `${cur} ${fmt(job.salary_min)} - ${fmt(job.salary_max)}`
      : job.salary_min != null
        ? `${cur} ${fmt(job.salary_min)}`
        : null;
    if (!range) return { amount: 'Negotiable', period: job.period || 'month' };
    return { amount: `${range}/`, period: job.period || 'month' };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>What type of jobs are you looking for?</Text>
              <Text style={styles.subtitle}>Please select at least one interest to proceed</Text>
            </View>
            <View style={styles.headerActions}>
              {isAdmin && onAdminJobs && (
                <TouchableOpacity
                  style={[styles.adminBtn, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '44' }]}
                  onPress={onAdminJobs}
                >
                  <MaterialIcons name="admin-panel-settings" size={20} color={colors.tertiary} />
                </TouchableOpacity>
              )}
              {onPostJob && (
                <TouchableOpacity
                  style={[styles.postJobBtn, { backgroundColor: colors.primaryContainer }]}
                  onPress={onPostJob}
                >
                  <MaterialIcons name="add" size={18} color={colors.onPrimaryContainer} />
                  <Text style={[styles.postJobText, { color: colors.onPrimaryContainer }]}>{t('postJob')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search for jobs, skills, or companies"
              placeholderTextColor={colors.onSurfaceVariant}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            <TouchableOpacity>
              <MaterialIcons name="my-location" size={20} color={colors.primaryContainer} />
            </TouchableOpacity>
          </View>

          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color={colors.primary} />
            <Text style={styles.locationText}>Dhaka, Bangladesh</Text>
          </View>

          <View style={styles.catGrid}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.catCard,
                    { width: catSize },
                    active
                      ? { backgroundColor: colors.primaryContainer }
                      : { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.outlineVariant + '33' },
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setActiveCategory(active ? null : cat.key)}
                >
                  <MaterialIcons
                    name={cat.icon}
                    size={22}
                    color={active ? colors.onPrimaryContainer : colors.primary}
                  />
                  <Text style={[styles.catLabel, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.feedHeader}>
            <View>
              <Text style={styles.feedTitle}>Recommended for you</Text>
              {cvData && (
                <Text style={styles.feedSubtitle}>{t('basedOnYourCv')}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setActiveCategory(null)}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {filteredJobs.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No jobs found for this category</Text>
              ) : filteredJobs.map(job => {
                const salary = formatSalary(job);
                const applied = !!appliedIds[job.id];
                const saved = !!savedIds[job.id];
                const match = cvData ? scoreJob(job, cvData) : null;
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobCard, { backgroundColor: colors.surfaceContainerLow, borderColor: 'rgba(255,255,255,0.05)' }]}
                    activeOpacity={0.85}
                    onPress={() => onViewJob && onViewJob(job)}
                  >
                    <View style={styles.jobRow}>
                      <View style={[styles.jobIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
                        {job.logo_url ? (
                          <Image source={{ uri: job.logo_url }} style={styles.jobLogo} resizeMode="contain" />
                        ) : (
                          <MaterialIcons name="work" size={24} color={colors.primaryContainer} />
                        )}
                      </View>
                      <View style={styles.jobBody}>
                        <View style={styles.jobTop}>
                          <View style={styles.jobInfo}>
                            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                            <Text style={styles.jobCompany} numberOfLines={1}>{job.company}</Text>
                          </View>
                          <View style={styles.jobSalary}>
                            <Text style={styles.salaryAmount} numberOfLines={1}>{salary.amount}</Text>
                            <Text style={styles.salaryPeriod}>{salary.period}</Text>
                          </View>
                        </View>
                        <View style={styles.jobMeta}>
                          {match && match.score >= 30 && (
                            <View style={[styles.matchBadge, { backgroundColor: colors.primary + '22' }]}>
                              <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
                              <Text style={[styles.matchText, { color: colors.primary }]}>{match.score}%</Text>
                            </View>
                          )}
                          <View style={[styles.typeBadge, { backgroundColor: colors.secondary + '33' }]}>
                            <Text style={[styles.typeText, { color: colors.secondary }]}>{job.type}</Text>
                          </View>
                          <View style={styles.jobLocRow}>
                            <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.jobLocText} numberOfLines={1}>{job.location}</Text>
                          </View>
                          {applied && (
                            <View style={[styles.appliedBadge, { backgroundColor: colors.secondary + '22' }]}>
                              <MaterialIcons name="check-circle" size={13} color={colors.secondary} />
                              <Text style={[styles.appliedText, { color: colors.secondary }]}>Applied</Text>
                            </View>
                          )}
                          {saved && (
                            <MaterialIcons name="bookmark" size={15} color={colors.primary} />
                          )}
                        </View>
                        {match && match.matched.length > 0 && (
                          <View style={styles.matchSkills}>
                            {match.matched.slice(0, 3).map((s, i) => (
                              <Text
                                key={i}
                                style={[styles.matchSkill, { color: colors.primary, backgroundColor: colors.primaryContainer + '22' }]}
                              >
                                {s}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: {
      padding: 16,
      paddingTop: (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24) + 16,
      paddingBottom: 120,
    },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    adminBtn: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    postJobBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    },
    postJobText: { fontFamily: FONTS.labelMd, fontSize: 12, fontWeight: '700' },
    title: { fontFamily: FONTS.headlineLg, fontSize: 24, lineHeight: 32, color: colors.onSurface, marginBottom: 4 },
    subtitle: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 16 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 4,
      borderRadius: 12, height: 48,
    },
    searchInput: { flex: 1, fontFamily: FONTS.bodyMd, fontSize: 14 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    locationText: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.primary },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20, marginBottom: 28 },
    catCard: {
      alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, borderRadius: 12,
      gap: 8,
    },
    catLabel: {
      fontFamily: FONTS.labelMd, fontSize: 10, lineHeight: 13,
      textAlign: 'center',
    },
    feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    feedTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, color: colors.onSurface },
    feedSubtitle: { fontFamily: FONTS.bodyMd, fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    viewAll: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.primary },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
    center: { paddingVertical: 48, justifyContent: 'center', alignItems: 'center' },
    matchBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    matchText: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '700' },
    matchSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    matchSkill: {
      fontFamily: FONTS.labelMd, fontSize: 11,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    jobCard: {
      borderRadius: 16, padding: 16,
      borderWidth: 1,
    },
    jobRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    jobIcon: {
      width: 48, height: 48, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    jobLogo: { width: 32, height: 32 },
    jobBody: { flex: 1, minWidth: 0 },
    jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    jobInfo: { flex: 1, minWidth: 0 },
    jobTitle: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface },
    jobCompany: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginTop: 1 },
    jobSalary: { alignItems: 'flex-end' },
    salaryAmount: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.primary },
    salaryPeriod: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant },
    jobMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 14 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    typeText: {
      fontSize: 10, fontWeight: '500', letterSpacing: 0.8,
      textTransform: 'uppercase', fontFamily: FONTS.labelMd,
    },
    jobLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    jobLocText: { fontFamily: FONTS.bodyMd, fontSize: 12, color: colors.onSurfaceVariant },
    appliedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    appliedText: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '600' },
  });
}
