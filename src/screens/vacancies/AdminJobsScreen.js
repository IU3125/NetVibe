import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';

const CATEGORY_ICONS = {
  services: 'headphones', education: 'menu-book', buysell: 'shopping-basket',
  sports: 'sports-soccer', arts: 'palette', it: 'devices',
  work: 'work', technology: 'biotech',
};

const STATUS_LABELS = {
  pending: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  closed: 'Closed',
};

const bullets = (items, color, styles) =>
  (items || []).map((item, i) => (
    <View key={i} style={styles.bulletRow}>
      <View style={[styles.bullet, { backgroundColor: color }]} />
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));

export default function AdminJobsScreen({ onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [tab, setTab] = useState('pending');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [selected, setSelected] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];

      const empIds = [...new Set(rows.map(j => j.employer_id).filter(Boolean))];
      let profileMap = {};
      if (empIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, email')
          .in('id', empIds);
        (profs || []).forEach(p => { profileMap[p.id] = p; });
      }

      setJobs(rows.map(j => ({ ...j, employer: profileMap[j.employer_id] || null })));
    } catch (err) {
      console.error(err);
      Alert.alert(t('error'), err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const setStatus = async (job, status) => {
    setUpdating(job.id);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', job.id);
      if (error) throw error;
      setSelected(null);
      await fetchJobs();
    } catch (err) {
      console.error(err);
      Alert.alert(t('error'), err.message);
    } finally {
      setUpdating(null);
    }
  };

  const tabs = ['pending', 'active', 'rejected'];
  const visible = jobs.filter(j => j.status === tab);

  const renderJob = (job) => {
    const isPending = job.status === 'pending';
    const salary = (() => {
      const cur = job.currency || 'USD';
      if (job.salary_min != null || job.salary_max != null) {
        const fmt = (n) => n != null ? n.toLocaleString() : '';
        const range = job.salary_min != null && job.salary_max != null
          ? `${cur} ${fmt(job.salary_min)} - ${fmt(job.salary_max)}`
          : job.salary_min != null ? `${cur} ${fmt(job.salary_min)}` : `${cur} ${fmt(job.salary_max)}`;
        return `${range}/${job.period || 'month'}`;
      }
      return 'Negotiable';
    })();

    return (
      <TouchableOpacity
        key={job.id}
        style={[styles.jobCard, { backgroundColor: colors.surfaceContainerLow }]}
        onPress={() => setSelected(job)}
        activeOpacity={0.85}
      >
        <View style={styles.jobTop}>
          <View style={[styles.jobIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
            <MaterialIcons name={CATEGORY_ICONS[job.category] || 'work'} size={22} color={colors.primaryContainer} />
          </View>
          <View style={styles.jobInfo}>
            <Text style={[styles.jobTitle, { color: colors.onSurface }]} numberOfLines={2}>{job.title}</Text>
            <Text style={[styles.jobCompany, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{job.company}</Text>
            <Text style={[styles.jobMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {job.type} · {job.location}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
        </View>
        <Text style={[styles.jobSalary, { color: colors.primary }]}>{salary}</Text>
        <View style={[styles.statusRow, { backgroundColor: colors.surfaceVariant }]}>
          <View style={[
            styles.statusDot,
            job.status === 'active'
              ? { backgroundColor: colors.secondary }
              : job.status === 'rejected'
                ? { backgroundColor: colors.error }
                : { backgroundColor: colors.tertiary },
          ]} />
          <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]}>
            {STATUS_LABELS[job.status] || job.status}
          </Text>
          <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>
            {job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}
          </Text>
        </View>
        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={() => setStatus(job, 'active')}
              disabled={updating === job.id}
            >
              {updating === job.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={16} color="#fff" />
                  <Text style={styles.actionText}>{t('approve')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.error }]}
              onPress={() => setStatus(job, 'rejected')}
              disabled={updating === job.id}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
              <Text style={styles.actionText}>{t('reject')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    const job = selected;
    if (!job) return null;
    const salary = (() => {
      const cur = job.currency || 'USD';
      if (job.salary_min != null || job.salary_max != null) {
        const fmt = (n) => n != null ? n.toLocaleString() : '';
        const range = job.salary_min != null && job.salary_max != null
          ? `${cur} ${fmt(job.salary_min)} - ${fmt(job.salary_max)}`
          : job.salary_min != null ? `${cur} ${fmt(job.salary_min)}` : `${cur} ${fmt(job.salary_max)}`;
        return `${range}/${job.period || 'month'}`;
      }
      return 'Negotiable';
    })();
    const emp = job.employer;

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[styles.modalWrap, { backgroundColor: colors.background }]}>
          <View style={[styles.modalTopBar, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelected(null)}>
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Job Details</Text>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentWrap}>
              <View style={[styles.detailHeader, { backgroundColor: colors.surfaceContainerLow }]}>
                <View style={[styles.jobIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
                  <MaterialIcons name={CATEGORY_ICONS[job.category] || 'work'} size={26} color={colors.primaryContainer} />
                </View>
                <View style={styles.detailTitleWrap}>
                  <Text style={[styles.detailTitle, { color: colors.onSurface }]}>{job.title}</Text>
                  <Text style={[styles.detailCompany, { color: colors.onSurfaceVariant }]}>{job.company}</Text>
                </View>
                <View style={[styles.detailStatus, { backgroundColor: colors.surfaceVariant }]}>
                  <View style={[
                    styles.statusDot,
                    job.status === 'active'
                      ? { backgroundColor: colors.secondary }
                      : job.status === 'rejected'
                        ? { backgroundColor: colors.error }
                        : { backgroundColor: colors.tertiary },
                  ]} />
                  <Text style={[styles.detailStatusText, { color: colors.onSurfaceVariant }]}>
                    {STATUS_LABELS[job.status] || job.status}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('salary')}</Text>
                <Text style={[styles.detailValue, { color: colors.onSurface }]}>{salary}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('employmentType')}</Text>
                <Text style={[styles.detailValue, { color: colors.onSurface }]}>{job.type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('category')}</Text>
                <Text style={[styles.detailValue, { color: colors.onSurface }]}>{job.category}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('location')}</Text>
                <Text style={[styles.detailValue, { color: colors.onSurface }]}>{job.location}{job.city ? `, ${job.city}` : ''}</Text>
              </View>
              {job.work_hours ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('workHours')}</Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>{job.work_hours}</Text>
                </View>
              ) : null}
              {job.apply_before ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{t('applyBefore')}</Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>{job.apply_before}</Text>
                </View>
              ) : null}

              <View style={[styles.detailCard, { backgroundColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.detailCardLabel, { color: colors.onSurfaceVariant }]}>{t('jobDescription')}</Text>
                <Text style={[styles.detailBody, { color: colors.onSurface }]}>
                  {job.description || '—'}
                </Text>
              </View>

              {job.responsibilities && job.responsibilities.length > 0 ? (
                <View style={[styles.detailCard, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.detailCardLabel, { color: colors.onSurfaceVariant }]}>{t('responsibilities')}</Text>
                  {bullets(job.responsibilities, colors.primary, styles)}
                </View>
              ) : null}

              {job.qualifications && job.qualifications.length > 0 ? (
                <View style={[styles.detailCard, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.detailCardLabel, { color: colors.onSurfaceVariant }]}>{t('qualifications')}</Text>
                  {bullets(job.qualifications, colors.secondary, styles)}
                </View>
              ) : null}

              {job.perks && job.perks.length > 0 ? (
                <View style={[styles.detailCard, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.detailCardLabel, { color: colors.onSurfaceVariant }]}>{t('perks')}</Text>
                  {bullets(job.perks, colors.tertiary, styles)}
                </View>
              ) : null}

              {emp && (
                <View style={[styles.employerCard, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.detailCardLabel, { color: colors.onSurfaceVariant }]}>Employer</Text>
                  <View style={styles.employerRow}>
                    {emp.avatar_url ? (
                      <Image source={{ uri: emp.avatar_url }} style={styles.employerAvatar} />
                    ) : (
                      <View style={[styles.employerAvatar, styles.employerAvatarPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
                        <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.employerName, { color: colors.onSurface }]}>
                        {emp.full_name || emp.username || 'User'}
                      </Text>
                      {emp.email ? (
                        <Text style={[styles.employerEmail, { color: colors.onSurfaceVariant }]}>{emp.email}</Text>
                      ) : null}
                    </View>
                    <MaterialIcons name="business" size={20} color={colors.onSurfaceVariant} />
                  </View>
                </View>
              )}

              {job.status === 'pending' && (
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                    onPress={() => setStatus(job, 'active')}
                    disabled={updating === job.id}
                  >
                    {updating === job.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="check" size={16} color="#fff" />
                        <Text style={styles.actionText}>{t('approve')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.error }]}
                    onPress={() => setStatus(job, 'rejected')}
                    disabled={updating === job.id}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                    <Text style={styles.actionText}>{t('reject')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Admin Panel</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {tabs.map(tb => {
          const count = jobs.filter(j => j.status === tb).length;
          const active = tab === tb;
          return (
            <TouchableOpacity
              key={tb}
              style={[styles.tab, active && { backgroundColor: colors.primaryContainer }]}
              onPress={() => setTab(tb)}
            >
              <Text style={[styles.tabText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                {STATUS_LABELS[tb]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="inbox" size={40} color={colors.outlineVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {tab === 'pending' ? t('noPendingJobs') : t('allApproved')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrap}>
            {visible.map(renderJob)}
          </View>
        </ScrollView>
      )}

      {renderDetail()}
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
    topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, fontWeight: '700', flex: 1 },
    tabs: {
      flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    },
    tab: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: colors.surfaceContainerLow,
    },
    tabText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    content: { padding: 16, paddingBottom: 80 },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 14 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center' },
    jobCard: { borderRadius: 16, padding: 16, gap: 12 },
    jobTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    jobIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    jobInfo: { flex: 1, minWidth: 0 },
    jobTitle: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700' },
    jobCompany: { fontFamily: FONTS.bodyMd, fontSize: 13, marginTop: 2 },
    jobMeta: { fontFamily: FONTS.bodyMd, fontSize: 12, marginTop: 2 },
    jobSalary: { fontFamily: FONTS.labelMd, fontSize: 12, fontWeight: '600' },
    statusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontFamily: FONTS.labelMd, fontSize: 12, textTransform: 'uppercase' },
    dateText: { fontFamily: FONTS.bodyMd, fontSize: 11, marginLeft: 'auto' },
    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, borderRadius: 10,
    },
    actionText: { fontFamily: FONTS.labelMd, fontSize: 13, fontWeight: '700', color: '#fff' },

    modalWrap: { flex: 1 },
    modalTopBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, fontWeight: '700', flex: 1 },
    modalContent: { padding: 16, paddingBottom: 60 },
    modalContentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 12 },
    detailHeader: {
      flexDirection: 'row', gap: 12, alignItems: 'center',
      borderRadius: 16, padding: 16,
    },
    detailTitleWrap: { flex: 1, minWidth: 0 },
    detailTitle: { fontFamily: FONTS.bodyLg, fontSize: 18, fontWeight: '700' },
    detailCompany: { fontFamily: FONTS.bodyMd, fontSize: 13, marginTop: 2 },
    detailStatus: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    },
    detailStatusText: { fontFamily: FONTS.labelMd, fontSize: 11, textTransform: 'uppercase' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    detailLabel: { fontFamily: FONTS.bodyMd, fontSize: 13 },
    detailValue: { fontFamily: FONTS.bodyMd, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    detailCard: { borderRadius: 16, padding: 16, gap: 8 },
    detailCardLabel: { fontFamily: FONTS.labelMd, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
    detailBody: { fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 21 },
    bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    bulletText: { fontFamily: FONTS.bodyMd, fontSize: 13, flex: 1, lineHeight: 20 },
    employerCard: { borderRadius: 16, padding: 16, gap: 10 },
    employerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    employerAvatar: { width: 36, height: 36, borderRadius: 18 },
    employerAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    employerName: { fontFamily: FONTS.bodyLg, fontSize: 14, fontWeight: '600' },
    employerEmail: { fontFamily: FONTS.bodyMd, fontSize: 12, marginTop: 2 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  });
}
