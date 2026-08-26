import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Linking, Alert, RefreshControl,
  Platform, StatusBar, TextInput, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
};

const JOB_STATUS_META = {
  pending: { color: '#f59e0b', icon: 'hourglass-empty' },
  active: { color: '#22c55e', icon: 'check-circle' },
  closed: { color: '#ef4444', icon: 'lock' },
  rejected: { color: '#ef4444', icon: 'block' },
};

const APP_ACTIONS = [
  { key: 'reviewed', icon: 'visibility', color: '#3b82f6' },
  { key: 'accepted', icon: 'check-circle', color: '#22c55e' },
  { key: 'rejected', icon: 'cancel', color: '#ef4444' },
];

const APP_STATUS_COLOR = {
  applied: '#94a3b8',
  reviewed: '#3b82f6',
  accepted: '#22c55e',
  rejected: '#ef4444',
};

export default function EmployerApplicationsScreen({ onBack, onOpenChat, onViewProfile }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [counts, setCounts] = useState({});
  const [selJob, setSelJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [notesOpenId, setNotesOpenId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [viewCvUrl, setViewCvUrl] = useState(null);

  const cvFor = (app) => app.cv_url || app.profile?.cv_url || null;

  const filteredApplicants = statusFilter === 'all'
    ? applicants
    : applicants.filter(a => a.status === statusFilter);

  const saveNote = async (appId) => {
    const note = (noteDrafts[appId] ?? applicants.find(a => a.id === appId)?.notes ?? '').trim();
    setApplicants(list => list.map(a => (a.id === appId ? { ...a, notes: note || null } : a)));
    setNotesOpenId(null);
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ notes: note || null })
        .eq('id', appId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message);
    }
  };

  const loadJobs = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows, error } = await supabase
        .from('jobs')
        .select('id, title, company, status, location, created_at')
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJobs(rows || []);

      const ids = (rows || []).map(j => j.id);
      if (ids.length) {
        const { data: apps } = await supabase
          .from('job_applications')
          .select('job_id')
          .in('job_id', ids);
        const map = {};
        (apps || []).forEach(a => { map[a.job_id] = (map[a.job_id] || 0) + 1; });
        setCounts(map);
      } else {
        setCounts({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const openJob = async (job) => {
    setSelJob(job);
    setStatusFilter('all');
    setNotesOpenId(null);
    setAppsLoading(true);
    try {
      const { data: apps, error } = await supabase
        .from('job_applications')
        .select('id, user_id, status, cover_letter, cv_url, created_at')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((apps || []).map(a => a.user_id))];
      let profMap = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, job_title, cv_url')
          .in('id', userIds);
        (profs || []).forEach(p => { profMap[p.id] = p; });
      }

      setApplicants((apps || []).map(a => ({ ...a, profile: profMap[a.user_id] || null })));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setAppsLoading(false);
    }
  };

  const setStatus = async (appId, status) => {
    const prev = applicants;
    setApplicants(list => list.map(a => (a.id === appId ? { ...a, status } : a)));
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', appId);
      if (error) throw error;
    } catch (err) {
      setApplicants(prev);
      console.error(err);
      Alert.alert('Error', err.message);
    }
  };

  const openCV = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open CV link'));
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selJob) openJob(selJob).then(() => loadJobs());
    else loadJobs();
  };

  const appStatusLabel = (status) =>
    t(status === 'applied' ? 'appNew' : status === 'reviewed' ? 'appReviewed' : status === 'accepted' ? 'appAccepted' : 'appRejected');

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (selJob ? setSelJob(null) : onBack())}>
          <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {selJob ? selJob.title : t('employerApps')}
          </Text>
          {!selJob && (
            <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>
              {jobs.length} {t('myJobPosts').toLowerCase()}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!selJob && jobs.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="work-off" size={40} color={colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{t('noApplicants')}</Text>
          </View>
        )}

        {/* Level 1 — my job posts */}
        {!selJob && jobs.map(job => {
          const meta = JOB_STATUS_META[job.status] || JOB_STATUS_META.pending;
          return (
            <TouchableOpacity
              key={String(job.id)}
              style={[styles.jobCard, { backgroundColor: colors.surfaceContainerLow }]}
              activeOpacity={0.8}
              onPress={() => openJob(job)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitle, { color: colors.onSurface }]} numberOfLines={1}>{job.title}</Text>
                <View style={styles.jobMetaRow}>
                  <MaterialIcons name="business" size={13} color={colors.onSurfaceVariant} />
                  <Text style={[styles.jobMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {job.company}
                  </Text>
                  <View style={[styles.statusDotWrap, { backgroundColor: meta.color + '22' }]}>
                    <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{job.status}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.countBadge, { backgroundColor: colors.primaryContainer }]}>
                <MaterialIcons name="person" size={12} color={colors.onPrimaryContainer} />
                <Text style={[styles.countText, { color: colors.onPrimaryContainer }]}>{counts[job.id] || 0}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          );
        })}

        {/* Level 2 — applicants */}
        {selJob && appsLoading && (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        )}

        {selJob && !appsLoading && applicants.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {['all', 'applied', 'reviewed', 'accepted', 'rejected'].map(key => {
              const active = statusFilter === key;
              const label = key === 'all' ? t('filterAll') : appStatusLabel(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '55' },
                    active && { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
                  ]}
                  onPress={() => setStatusFilter(key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.onSurfaceVariant },
                      active && { color: colors.onPrimaryContainer, fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {selJob && !appsLoading && applicants.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="person-off" size={40} color={colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{t('noApplicants')}</Text>
          </View>
        )}

        {selJob && !appsLoading && filteredApplicants.map(app => {
          const p = app.profile;
          return (
            <View key={String(app.id)} style={[styles.appCard, { backgroundColor: colors.surfaceContainerLow }]}>
              <View style={styles.appTopRow}>
                {p?.avatar_url ? (
                  <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.avatarInitial, { color: colors.onPrimaryContainer }]}>
                      {(p?.full_name || p?.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => onViewProfile && onViewProfile(app.user_id)} activeOpacity={0.6}>
                    <Text style={[styles.appName, { color: colors.onSurface }]} numberOfLines={1}>
                      {p?.full_name || p?.username || 'User'}
                    </Text>
                  </TouchableOpacity>
                  {!!p?.job_title && (
                    <Text style={[styles.appRole, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{p.job_title}</Text>
                  )}
                  <Text style={[styles.appTime, { color: colors.onSurfaceVariant }]}>{timeAgo(app.created_at)}</Text>
                </View>
                <View style={[styles.appStatusChip, { backgroundColor: APP_STATUS_COLOR[app.status] + '22' }]}>
                  <Text style={[styles.appStatusText, { color: APP_STATUS_COLOR[app.status] }]}>
                    {appStatusLabel(app.status)}
                  </Text>
                </View>
              </View>

              {!!app.cover_letter && (
                <Text style={[styles.coverLetter, { color: colors.onSurfaceVariant, borderColor: colors.outlineVariant + '55' }]} numberOfLines={3}>
                  {app.cover_letter}
                </Text>
              )}

              {!!app.notes && notesOpenId !== app.id && (
                <View style={[styles.notePreview, { backgroundColor: colors.surfaceContainer, borderLeftColor: colors.secondary }]}>
                  <MaterialIcons name="sticky-note-2" size={13} color={colors.secondary} />
                  <Text style={[styles.notePreviewText, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                    {app.notes}
                  </Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.cvBtn,
                    { backgroundColor: cvFor(app) ? colors.primaryContainer : colors.surfaceContainer },
                  ]}
                  disabled={!cvFor(app)}
                  onPress={() => setViewCvUrl(cvFor(app))}
                >
                  <MaterialIcons
                    name="description"
                    size={15}
                    color={cvFor(app) ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.cvBtnText,
                      { color: cvFor(app) ? colors.onPrimaryContainer : colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {cvFor(app) ? t('viewCV') : t('noCV')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.noteBtn,
                    {
                      borderColor: notesOpenId === app.id || app.notes ? colors.secondary : colors.outlineVariant + '66',
                      backgroundColor: notesOpenId === app.id ? colors.secondary + '22' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setNotesOpenId(notesOpenId === app.id ? null : app.id);
                    setNoteDrafts(d => ({ ...d, [app.id]: app.notes || '' }));
                  }}
                >
                  <MaterialIcons
                    name="edit-note"
                    size={15}
                    color={notesOpenId === app.id || app.notes ? colors.secondary : colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {APP_ACTIONS.map(action => {
                  const active = app.status === action.key;
                  return (
                    <TouchableOpacity
                      key={action.key}
                      style={[
                        styles.statusBtn,
                        active && { backgroundColor: action.color + '22', borderColor: action.color },
                      ]}
                      onPress={() => setStatus(app.id, action.key)}
                    >
                      <MaterialIcons name={action.icon} size={15} color={action.color} />
                    </TouchableOpacity>
                  );
                })}

                {app.status === 'accepted' && onOpenChat && (
                  <TouchableOpacity
                    style={[styles.chatBtn, { backgroundColor: '#22c55e22', borderColor: '#22c55e' }]}
                    onPress={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        const { data: convId, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: app.user_id });
                        if (error) throw error;
                        onOpenChat({
                          id: convId,
                          restricted: true,
                          partnerId: app.user_id,
                          partnerName: p?.full_name || p?.username || 'User',
                          partnerAvatar: p?.avatar_url,
                          jobTitle: selJob?.title,
                        });
                      } catch (err) {
                        Alert.alert('Error', err.message);
                      }
                    }}
                  >
                    <MaterialIcons name="chat" size={15} color="#22c55e" />
                  </TouchableOpacity>
                )}
              </View>

              {notesOpenId === app.id && (
                <View style={[styles.noteEditor, { borderColor: colors.outlineVariant + '55' }]}>
                  <TextInput
                    style={[styles.noteInput, { color: colors.onSurface }]}
                    placeholder={t('notePlaceholder')}
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={noteDrafts[app.id] ?? ''}
                    onChangeText={text => setNoteDrafts(d => ({ ...d, [app.id]: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.noteSaveBtn, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => saveNote(app.id)}
                  >
                    <MaterialIcons name="check" size={14} color={colors.onPrimaryContainer} />
                    <Text style={[styles.noteSaveText, { color: colors.onPrimaryContainer }]}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* In-app CV viewer */}
      <Modal
        visible={!!viewCvUrl}
        animationType="slide"
        onRequestClose={() => setViewCvUrl(null)}
        statusBarTranslucent
      >
        <View style={styles.cvViewer}>
          <View style={[styles.cvViewerHeader, { backgroundColor: colors.surfaceContainerLow }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setViewCvUrl(null)}>
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.cvViewerTitle, { color: colors.onSurface }]} numberOfLines={1}>
              {decodeURIComponent((viewCvUrl || '').split('/').pop() || 'CV.pdf')}
            </Text>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => Linking.openURL(viewCvUrl).catch(() => Alert.alert('Error', 'Could not open CV link'))}
            >
              <MaterialIcons name="open-in-new" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewCvUrl)}` }}
            style={{ flex: 1, backgroundColor: colors.surfaceContainer }}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -14 }} color={colors.primary} />
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    backgroundColor: colors.background,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { padding: 6, marginLeft: -6 },
  headerTitle: { ...FONTS.headlineMd, fontSize: 18 },
  headerSub: { ...FONTS.bodyMd, fontSize: 12, marginTop: 1 },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  jobTitle: { ...FONTS.headlineMd, fontSize: 15, marginBottom: 4 },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  jobMeta: { ...FONTS.labelMd, flexShrink: 1 },
  statusDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    marginLeft: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...FONTS.labelMd, fontSize: 10 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    height: 26,
    borderRadius: 13,
  },
  countText: { ...FONTS.labelMd, fontWeight: '700' },
  emptyCard: { alignItems: 'center', gap: 10, borderRadius: 16, padding: 32, marginTop: 24 },
  emptyText: { ...FONTS.bodyMd, fontSize: 14, textAlign: 'center' },
  appCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  appTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { ...FONTS.headlineMd, fontSize: 17 },
  appName: { ...FONTS.headlineMd, fontSize: 15 },
  appRole: { ...FONTS.labelMd, fontSize: 12 },
  appTime: { ...FONTS.labelMd, fontSize: 11, marginTop: 1 },
  appStatusChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  appStatusText: { ...FONTS.labelMd, fontSize: 10, fontWeight: '700' },
  coverLetter: {
    ...FONTS.bodyMd,
    fontSize: 13,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: 30,
    borderRadius: 15,
    maxWidth: '52%',
  },
  cvBtnText: { ...FONTS.labelMd },
  statusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: { ...FONTS.labelMd, fontSize: 12 },
  notePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  notePreviewText: { ...FONTS.bodyMd, fontSize: 12, flexShrink: 1 },
  noteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteEditor: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  noteInput: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
  },
  noteSaveText: { ...FONTS.labelMd, fontSize: 12, fontWeight: '700' },
  cvViewer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
  },
  cvViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  cvViewerTitle: { ...FONTS.headlineMd, fontSize: 15, flex: 1 },
});
