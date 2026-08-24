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
import { cacheGet, cacheSet } from '../../lib/cache';
import { findCountry } from '../../lib/cities';
import CityPickerModal from '../../components/CityPickerModal';
import * as Location from 'expo-location';

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

export default function VacanciesScreen({ onViewJob, onPostJob, onAdminJobs, onEmployerApps }) {
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
  const [isEmployer, setIsEmployer] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [minSalary, setMinSalary] = useState('');
  const [sortBy, setSortBy] = useState('match');
  const [recCities, setRecCities] = useState([]);
  const [recCountryName, setRecCountryName] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);

  const fetchData = useCallback(async () => {
    const cached = await cacheGet('jobs');
    if (cached && Array.isArray(cached.data) && cached.data.length) {
      setJobs(cached.data);
      setLoading(false);
    }
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
      cacheSet('jobs', rows || []);

      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(!!prof?.is_admin);

        const { data: ownJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('employer_id', user.id)
          .limit(1);
        setIsEmployer(!!ownJobs && ownJobs.length > 0);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10&addressdetails=1`,
            { headers: { 'User-Agent': 'NetVibe/1.0 (recommended cities)' } }
          );
          const data = await res.json();
          const cc = data?.address?.country_code;
          const country = findCountry(cc);
          if (country && alive) {
            setRecCities(country.cities);
            setRecCountryName(country.name);
            return;
          }
        }
      } catch (e) {
        // fall through to default
      }
      if (alive) {
        const def = findCountry('az');
        setRecCities(def.cities);
        setRecCountryName(def.name);
      }
    })();
    return () => { alive = false; };
  }, []);

  const jobTypes = useMemo(
    () => [...new Set(jobs.map(j => j.type).filter(Boolean))].sort(),
    [jobs]
  );
  const activeFilterCount =
    (filterCity ? 1 : 0) + (filterType ? 1 : 0) + (minSalary ? 1 : 0);

  const resetFilters = () => {
    setFilterCity(null);
    setFilterType(null);
    setMinSalary('');
    setSortBy('match');
  };

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
    if (filterCity) {
      const fc = filterCity.toLowerCase();
      list = list.filter(j => j.location && j.location.toLowerCase().includes(fc));
    }
    if (filterType) list = list.filter(j => j.type === filterType);
    const minS = parseFloat(minSalary);
    if (!isNaN(minS) && minS > 0) {
      list = list.filter(j => {
        const top = j.salary_max != null ? j.salary_max : j.salary_min;
        return top != null && top >= minS;
      });
    }
    if (sortBy === 'salary') {
      list = [...list].sort((a, b) => {
        const av = a.salary_max != null ? a.salary_max : a.salary_min ?? -1;
        const bv = b.salary_max != null ? b.salary_max : b.salary_min ?? -1;
        return bv - av;
      });
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (cvData) {
      list = rankJobs(list, cvData);
    }
    return list;
  }, [jobs, query, activeCategory, cvData, filterCity, filterType, minSalary, sortBy]);

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
              {(isEmployer || isAdmin) && onEmployerApps && (
                <TouchableOpacity
                  style={[styles.adminBtn, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '44' }]}
                  onPress={onEmployerApps}
                >
                  <MaterialIcons name="assignment-ind" size={20} color={colors.primary} />
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

          {recCities.length > 0 && (
            <View style={[styles.recSection, { backgroundColor: colors.surfaceContainerLow }]}>
              <View style={styles.recHeader}>
                <View style={[styles.recIconWrap, { backgroundColor: colors.primaryContainer }]}>
                  <MaterialIcons name="near-me" size={14} color={colors.onPrimaryContainer} />
                </View>
                <Text style={[styles.recLabel, { color: colors.onSurface }]} numberOfLines={1}>
                  {t('recommendedCities')}
                </Text>
                {!!recCountryName && (
                  <View style={[styles.recCountryBadge, { backgroundColor: colors.secondary + '22' }]}>
                    <Text style={[styles.recCountryText, { color: colors.secondary }]} numberOfLines={1}>
                      {recCountryName}
                    </Text>
                  </View>
                )}
                <View style={styles.recActions}>
                  <TouchableOpacity
                    style={styles.recActionBtn}
                    activeOpacity={0.75}
                    onPress={() => setShowFilters(v => !v)}
                  >
                    <MaterialIcons name="tune" size={15} color={colors.primary} />
                    {activeFilterCount > 0 && <View style={styles.recDot} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recActionBtn}
                    activeOpacity={0.75}
                    onPress={() => setShowCityPicker(true)}
                  >
                    <MaterialIcons name="swap-horiz" size={15} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                {recCities.map(c => {
                  const active = filterCity === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      activeOpacity={0.75}
                      style={[
                        styles.recChip,
                        { borderColor: colors.outlineVariant + '55' },
                        active && { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
                      ]}
                      onPress={() => setFilterCity(active ? null : c)}
                    >
                      <MaterialIcons
                        name={active ? 'check-circle' : 'location-city'}
                        size={13}
                        color={active ? colors.onPrimaryContainer : colors.primary}
                      />
                      <Text
                        style={[styles.recChipText, { color: colors.onSurfaceVariant }, active && { color: colors.onPrimaryContainer, fontWeight: '700' }]}
                        numberOfLines={1}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {showFilters && (
            <View style={[styles.filterPanel, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.filterLabel, { color: colors.onSurfaceVariant }]}>{t('city')}</Text>
              <View style={styles.chipWrap}>
                <TouchableOpacity
                  style={[styles.chip, filterCity === null ? styles.chipActive : null]}
                  onPress={() => setFilterCity(null)}
                >
                  <Text style={[styles.chipText, filterCity === null && styles.chipTextActive]}>{t('allCities')}</Text>
                </TouchableOpacity>
                {recCities.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, filterCity === c ? styles.chipActive : null]}
                    onPress={() => setFilterCity(filterCity === c ? null : c)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.chipText, filterCity === c && styles.chipTextActive]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {jobTypes.length > 0 && (
                <>
                  <Text style={[styles.filterLabel, { color: colors.onSurfaceVariant }]}>{t('employmentType')}</Text>
                  <View style={styles.chipWrap}>
                    <TouchableOpacity
                      style={[styles.chip, filterType === null ? styles.chipActive : null]}
                      onPress={() => setFilterType(null)}
                    >
                      <Text style={[styles.chipText, filterType === null && styles.chipTextActive]}>{t('all')}</Text>
                    </TouchableOpacity>
                    {jobTypes.map(tp => (
                      <TouchableOpacity
                        key={tp}
                        style={[styles.chip, filterType === tp ? styles.chipActive : null]}
                        onPress={() => setFilterType(filterType === tp ? null : tp)}
                      >
                        <Text style={[styles.chipText, filterType === tp && styles.chipTextActive]}>{tp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.filterLabel, { color: colors.onSurfaceVariant }]}>{t('minSalary')}</Text>
              <TextInput
                style={[styles.minSalaryInput, { borderColor: colors.outlineVariant + '55', color: colors.onSurface }]}
                placeholder="0"
                placeholderTextColor={colors.onSurfaceVariant}
                value={minSalary}
                onChangeText={setMinSalary}
                keyboardType="number-pad"
              />

              <Text style={[styles.filterLabel, { color: colors.onSurfaceVariant }]}>{t('sortBy')}</Text>
              <View style={styles.chipWrap}>
                {[
                  ['match', t('bestMatch')],
                  ['newest', t('sortNewest')],
                  ['salary', t('salaryHighToLow')],
                ].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, sortBy === key ? styles.chipActive : null]}
                    onPress={() => setSortBy(key)}
                  >
                    <Text style={[styles.chipText, sortBy === key && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {activeFilterCount > 0 || sortBy !== 'match' ? (
                <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
                  <MaterialIcons name="refresh" size={14} color={colors.primary} />
                  <Text style={[styles.resetText, { color: colors.primary }]}>{t('resetFilters')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

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

      <CityPickerModal
        visible={showCityPicker}
        onClose={() => setShowCityPicker(false)}
        onSelect={setFilterCity}
        onClear={() => setFilterCity(null)}
      />
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
    recActions: { flexDirection: 'row', marginLeft: 'auto', gap: 6 },
    recActionBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.outlineVariant + '55',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    recSection: {
      marginTop: 12,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    recHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recLabel: {
      fontFamily: FONTS.labelMd,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
    },
    recCountryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      maxWidth: 110,
    },
    recCountryText: {
      fontFamily: FONTS.labelMd,
      fontSize: 10,
      fontWeight: '700',
    },
    recChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    recChipText: {
      fontFamily: FONTS.labelMd,
      fontSize: 12,
    },
    filterPanel: {
      marginTop: 10,
      borderRadius: 14,
      padding: 14,
      gap: 8,
    },
    filterLabel: {
      fontFamily: FONTS.labelMd,
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 4,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainerHighest,
      maxWidth: '100%',
    },
    chipActive: { backgroundColor: colors.primaryContainer },
    chipText: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.onSurfaceVariant },
    chipTextActive: { color: colors.onPrimaryContainer, fontWeight: '600' },
    minSalaryInput: {
      height: 40,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      fontFamily: FONTS.bodyMd,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 4,
      paddingVertical: 4,
    },
    resetText: { fontFamily: FONTS.labelMd, fontSize: 12 },
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
