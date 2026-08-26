import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, StatusBar, ActivityIndicator, Share, Animated, TextInput, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';

const bullets = (items, color, styles) =>
  (items || []).map((item, i) => (
    <View key={i} style={styles.bulletRow}>
      <View style={[styles.bullet, { backgroundColor: color }]} />
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));

export default function JobDetailScreen({ job, onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(null);
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [jobId, setJobId] = useState(job?.id);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverText, setCoverText] = useState('');
  const [userCvUrl, setUserCvUrl] = useState(null);
  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showSuccess) return;
    const loop = Animated.loop(
      Animated.timing(ping, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => { loop.stop(); ping.setValue(0); };
  }, [showSuccess, ping]);

  useEffect(() => {
    setJobId(job?.id);
  }, [job]);

  useEffect(() => {
    if (jobId == null) return;
    let cancelled = false;
    const fetchJob = async () => {
      setLoading(true);
      try {
        const { data: row, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        if (error) throw error;
        if (!cancelled) setD(row);
      } catch (err) {
        console.error(err);
        if (!cancelled) setD(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchJob();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    if (jobId == null) return;
    let cancelled = false;
    const fetchState = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: app } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', jobId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && app) setApplied(app);
        const { data: sv } = await supabase
          .from('saved_jobs')
          .select('id')
          .eq('job_id', jobId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setSaved(!!sv);
      } catch (err) {
        console.error(err);
      }
    };
    fetchState();
    return () => { cancelled = true; };
  }, [jobId]);

  const openApplyModal = async () => {
    setShowApplyModal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('cv_url')
        .eq('id', user.id)
        .maybeSingle();
      setUserCvUrl(prof?.cv_url || null);
    } catch (err) {
      console.error(err);
    }
  };

  const apply = async () => {
    if (!applied && !applying) {
      setApplying(true);
      const { data, error } = await supabase.rpc('apply_to_job', {
        job_id: jobId,
        cover: coverText.trim() || null,
        cv: userCvUrl || null,
      });
      setApplying(false);
      if (!error && data) {
        setApplied(data);
        setShowApplyModal(false);
        setCoverText('');
        setShowSuccess(true);
      } else {
        console.error(error);
      }
    }
  };

  const toggleSaved = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (saved) {
        await supabase.from('saved_jobs')
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', user.id);
        setSaved(false);
      } else {
        await supabase.from('saved_jobs')
          .upsert({ job_id: jobId, user_id: user.id }, { onConflict: 'job_id,user_id' });
        setSaved(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onShare = async () => {
    if (!d) return;
    try {
      await Share.share({
        message: `${d.title} at ${d.company} — ${d.location}. Apply now on NetVibe!`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatSalary = (job) => {
    const cur = job?.currency || 'USD';
    const fmt = (n) => n != null ? n.toLocaleString() : '';
    if (job?.salary_min != null && job?.salary_max != null) {
      return `${cur} ${fmt(job.salary_min)} - ${fmt(job.salary_max)}/${job.period || 'mo'}`;
    }
    if (job?.salary_min != null) return `${cur} ${fmt(job.salary_min)}/${job.period || 'mo'}`;
    return 'Negotiable';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Job Details</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!d) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Job Details</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color={colors.outline} />
          <Text style={[styles.notFoundText, { color: colors.onSurfaceVariant }]}>Job not found</Text>
        </View>
      </View>
    );
  }

  if (showSuccess) {
    const pingScale = ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
    const pingOpacity = ping.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] });
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[StyleSheet.absoluteFill, styles.successGlow]} pointerEvents="none" />
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <View style={[styles.successRing, { borderColor: colors.primaryContainer }]}>
              <Animated.View
                style={[styles.successPing, {
                  borderColor: colors.primaryContainer,
                  transform: [{ scale: pingScale }],
                  opacity: pingOpacity,
                }]}
              />
              <View style={[styles.successCircle, { backgroundColor: colors.primaryContainer }]}>
                <MaterialIcons name="check" size={72} color="#fff" />
              </View>
            </View>
          </View>
          <Text style={styles.successTitle}>Congratulations!</Text>
          <Text style={styles.successSub}>Your Application submitted</Text>
          <View style={styles.successActions}>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.primaryContainer }]}
              activeOpacity={0.85}
              onPress={onBack}
            >
              <Text style={[styles.browseBtnText, { color: colors.onPrimaryContainer }]}>Browse</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSuccess(false)}>
              <Text style={styles.viewDetailsBtn}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>
          Job Details
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={onShare}>
            <MaterialIcons name="share" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <MaterialIcons name="notifications-none" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrap}>
          <View style={styles.banner}>
            {d.banner_url && (
              <Image source={{ uri: d.banner_url }} style={styles.bannerImg} resizeMode="cover" />
            )}
            <LinearGradient
              colors={['transparent', colors.background + 'CC', colors.background]}
              style={styles.bannerGradient}
            />
            <View style={styles.bannerBottom}>
              <View style={[styles.logoBox, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                {d.logo_url ? (
                  <Image source={{ uri: d.logo_url }} style={styles.logoImg} resizeMode="contain" />
                ) : (
                  <MaterialIcons name="work" size={28} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.companyName} numberOfLines={1}>{d.company}</Text>
                <Text style={styles.companyCategory}>{d.category || 'Job'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D' }]}>
              <MaterialIcons name="payments" size={18} color={colors.primary} />
              <Text style={styles.chipText}>{formatSalary(d)}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D' }]}>
              <MaterialIcons name="schedule" size={18} color={colors.secondary} />
              <Text style={styles.chipText}>{d.type}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D' }]}>
              <MaterialIcons name="location-on" size={18} color={colors.tertiary} />
              <Text style={styles.chipText}>{d.location}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="description" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Job Description</Text>
            </View>
            <Text style={styles.cardBody}>{d.description || 'No description available.'}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="task-alt" size={22} color={colors.secondary} />
              <Text style={styles.cardTitle}>Responsibilities</Text>
            </View>
            {bullets(d.responsibilities, colors.secondary, styles)}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="school" size={22} color={colors.tertiary} />
              <Text style={styles.cardTitle}>Qualifications</Text>
            </View>
            {bullets(d.qualifications, colors.tertiary, styles)}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D', alignItems: 'center' }]}>
            <View style={[styles.positionIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
              <MaterialIcons name="work" size={24} color={colors.primary} />
            </View>
            <Text style={styles.positionLabel}>Position</Text>
            <Text style={styles.positionValue}>{d.title}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant + '4D' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="calendar-today" size={20} color={colors.secondary} />
              <Text style={[styles.cardTitle, { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }]}>Work Hours</Text>
            </View>
            <Text style={styles.workLine}>{d.weekly || 'Weekly: 5 days'}</Text>
            <Text style={styles.workSub}>{d.work_days || 'Sunday to Thursday'}</Text>
            <Text style={styles.workSub}>{d.work_hours ? `(${d.work_hours})` : ''}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="star" size={20} color={colors.tertiary} />
              <Text style={[styles.cardTitle, { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }]}>Perks & Facilities</Text>
            </View>
            <View style={styles.perkRow}>
              {(d.perks || []).map((p, i) => (
                <View key={i} style={[styles.perkChip, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={styles.perkText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.applyBannerWrap}>
            <LinearGradient
              colors={[colors.error + 'DD', colors.error + '88', colors.error + '44']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.applyBanner}
            >
              <View style={styles.applyBannerLeft}>
                <View style={styles.applyBannerIconWrap}>
                  <MaterialIcons name="schedule" size={26} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.applyBannerLabel}>{t('applyBefore')}</Text>
                  <Text style={styles.applyBannerValue}>
                    {formatDate(d.apply_before) || t('openUntilFilled')}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.outlineVariant + '22' }]}>
        <View style={styles.bottomBarInner}>
          <TouchableOpacity
            style={[styles.bookmarkBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant + '44' }]}
            onPress={toggleSaved}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={saved ? 'bookmark' : 'bookmark-border'}
              size={22}
              color={saved ? colors.primary : colors.onSurfaceVariant}
            />
          </TouchableOpacity>
          {applied ? (
            <View style={[styles.applyBtn, { backgroundColor: colors.secondaryContainer, borderColor: colors.secondary + '33' }]}>
              <MaterialIcons name="check-circle" size={19} color={colors.secondary} />
              <Text style={[styles.applyBtnText, { color: colors.secondary }]}>
                {applied.status === 'accepted' ? t('accepted') : applied.status === 'rejected' ? t('rejected') : t('applied')}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.applyBtnGradient}
              activeOpacity={0.85}
              onPress={openApplyModal}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyBtnGradInner}
              >
                <MaterialIcons name="send" size={18} color={colors.onPrimary} />
                <Text style={[styles.applyBtnText, { color: colors.onPrimary }]}>
                  {t('applyNow')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Apply modal */}
      <Modal
        visible={showApplyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApplyModal(false)}
      >
        <View style={styles.applyOverlay}>
          <TouchableOpacity
            style={styles.applyOverlayBackdrop}
            activeOpacity={1}
            onPress={() => setShowApplyModal(false)}
          />
          <View style={[styles.applySheet, { backgroundColor: colors.surfaceContainerLow }]}>
            {/* Drag handle */}
            <View style={styles.sheetGrabber}>
              <View style={[styles.grabberBar, { backgroundColor: colors.outlineVariant }]} />
            </View>

            {/* Header: title + close */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.outlineVariant + '33' }]}>
              <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>{t('applyModalTitle')}</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)} style={styles.sheetCloseBtn}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} keyboardShouldPersistTaps="handled">
              {/* CV Card */}
              <View style={[styles.cvCard, {
                backgroundColor: userCvUrl ? colors.primaryContainer + '33' : colors.error + '11',
                borderColor: userCvUrl ? colors.primary + '33' : colors.error + '33',
              }]}>
                <View style={[styles.cvCardIcon, { backgroundColor: userCvUrl ? colors.primary + '22' : colors.error + '22' }]}>
                  <MaterialIcons name="description" size={20} color={userCvUrl ? colors.primary : colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cvCardName, { color: colors.onSurface }]} numberOfLines={1}>
                    {userCvUrl
                      ? decodeURIComponent(userCvUrl.split('/').pop() || 'CV.pdf')
                      : t('noCvWarning')}
                  </Text>
                  {userCvUrl && (
                    <Text style={[styles.cvCardSub, { color: colors.onSurfaceVariant }]}>{t('yourCv')}</Text>
                  )}
                </View>
                {userCvUrl ? (
                  <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                ) : (
                  <MaterialIcons name="warning" size={20} color={colors.error} />
                )}
              </View>

              {/* Cover letter */}
              <Text style={[styles.coverLabel, { color: colors.onSurfaceVariant }]}>{t('coverLetterHint')}</Text>
              <TextInput
                style={[styles.coverInput, {
                  borderColor: colors.outlineVariant + '55',
                  color: colors.onSurface,
                  backgroundColor: colors.surfaceContainer,
                }]}
                placeholder={t('coverLetterHint')}
                placeholderTextColor={colors.onSurfaceVariant}
                value={coverText}
                onChangeText={setCoverText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Sticky send button */}
            <View style={[styles.sheetFooter, { borderTopColor: colors.outlineVariant + '33' }]}>
              <TouchableOpacity
                style={[
                  styles.sendBtnGradient,
                  (!userCvUrl || applying) && { opacity: 0.45 },
                ]}
                activeOpacity={0.85}
                onPress={apply}
                disabled={!userCvUrl || applying}
              >
                <LinearGradient
                  colors={userCvUrl ? [colors.primary, colors.primary + 'CC'] : [colors.outlineVariant, colors.outlineVariant]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendBtnGradInner}
                >
                  {applying ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={16} color={colors.onPrimary} />
                      <Text style={[styles.sendBtnText, { color: colors.onPrimary }]}>
                        {t('sendApplication')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      paddingBottom: 8, paddingHorizontal: 4,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    headerBtn: { padding: 8 },
    headerTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, flex: 1, textAlign: 'center' },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    notFoundText: { fontFamily: FONTS.bodyMd, fontSize: 14 },
    content: { padding: 16, paddingBottom: 150 },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 16 },
    banner: {
      height: 192, borderRadius: 12, overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    bannerImg: { ...StyleSheet.absoluteFillObject },
    bannerGradient: { ...StyleSheet.absoluteFillObject },
    bannerBottom: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16,
    },
    logoBox: {
      width: 64, height: 64, borderRadius: 16,
      borderWidth: 1, padding: 6,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'rgba(30,30,30,0.7)',
    },
    logoImg: { width: 48, height: 48 },
    companyName: { fontFamily: FONTS.headlineLg, fontSize: 24, lineHeight: 32, color: colors.onSurface },
    companyCategory: {
      fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1,
    },
    chipText: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurface },
    card: {
      borderRadius: 12, borderWidth: 1,
      padding: 16, gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, color: colors.onSurface },
    cardBody: {
      fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 22,
      color: colors.onSurfaceVariant,
    },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    bulletText: {
      flex: 1, fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 20,
      color: colors.onSurfaceVariant,
    },
    positionIcon: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center',
    },
    positionLabel: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant },
    positionValue: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, color: colors.onSurface },
    workLine: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurface },
    workSub: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    perkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    perkChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    perkText: { fontFamily: FONTS.bodyMd, fontSize: 13, color: colors.onSurface },
    applyBannerWrap: {
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 6,
      shadowColor: colors.error,
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    applyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
      gap: 14,
    },
    applyBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    applyBannerIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    applyBannerLabel: {
      fontFamily: FONTS.labelMd,
      fontSize: 11,
      color: 'rgba(255,255,255,0.75)',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 3,
    },
    applyBannerValue: {
      fontFamily: FONTS.headlineMd,
      fontSize: 17,
      fontWeight: '700',
      color: '#fff',
    },
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTopWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    },
    bottomBarInner: {
      width: '100%', maxWidth: 600, alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    bookmarkBtn: {
      width: 52, height: 52, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1,
    },
    applyBtn: {
      flex: 1, height: 52, borderRadius: 16,
      flexDirection: 'row', gap: 8,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1,
    },
    applyBtnGradient: {
      flex: 1, height: 52, borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    applyBtnGradInner: {
      flex: 1, height: 52, borderRadius: 16,
      flexDirection: 'row', gap: 8,
      justifyContent: 'center', alignItems: 'center',
    },
    applyBtnText: { fontFamily: FONTS.headlineMd, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
    successGlow: {
      backgroundColor: 'transparent',
      opacity: 1,
    },
    successWrap: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 32,
      overflow: 'hidden',
    },
    successIconWrap: { position: 'relative', marginBottom: 28 },
    successRing: {
      width: 132, height: 132, borderRadius: 66,
      justifyContent: 'center', alignItems: 'center',
    },
    successPing: {
      position: 'absolute', width: 132, height: 132, borderRadius: 66,
      borderWidth: 4,
    },
    successCircle: {
      width: 128, height: 128, borderRadius: 64,
      justifyContent: 'center', alignItems: 'center',
      elevation: 12, shadowColor: colors.primary, shadowOpacity: 0.4,
      shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    },
    successTitle: {
      fontFamily: FONTS.headlineLg, fontSize: 24, lineHeight: 32, fontWeight: '700',
      color: colors.onSurface, letterSpacing: -0.5, marginBottom: 8,
    },
    successSub: {
      fontFamily: FONTS.bodyLg, fontSize: 16, lineHeight: 24,
      color: colors.onSurfaceVariant, textAlign: 'center',
      maxWidth: 280, marginBottom: 32,
    },
    successActions: { width: '100%', maxWidth: 320, alignItems: 'center', gap: 20 },
    browseBtn: {
      width: '100%', paddingVertical: 16, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
      elevation: 8, shadowColor: '#000', shadowOpacity: 0.3,
      shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    },
    browseBtnText: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, fontWeight: '600' },
    viewDetailsBtn: {
      fontFamily: FONTS.labelMd, fontSize: 12, letterSpacing: 2,
      color: colors.primary, textTransform: 'uppercase',
      paddingVertical: 6,
    },
    applyOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.50)',
      justifyContent: 'flex-end',
    },
    applyOverlayBackdrop: {
      flex: 1,
    },
    applySheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '65%',
    },
    sheetGrabber: { alignItems: 'center', paddingBottom: 8 },
    grabberBar: { width: 36, height: 4, borderRadius: 2 },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
    },
    sheetTitle: { fontFamily: FONTS.headlineMd, fontSize: 19, fontWeight: '700' },
    sheetCloseBtn: { padding: 4 },
    sheetScroll: { flex: 1 },
    sheetScrollContent: { padding: 20, gap: 16 },
    cvCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 14, borderWidth: 1,
    },
    cvCardIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    cvCardName: { fontFamily: FONTS.bodyMd, fontSize: 14, fontWeight: '600' },
    cvCardSub: { fontFamily: FONTS.labelMd, fontSize: 11, marginTop: 2 },
    coverLabel: { fontFamily: FONTS.labelMd, fontSize: 12, marginBottom: -8 },
    coverInput: {
      fontFamily: FONTS.bodyMd,
      fontSize: 14,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      minHeight: 76,
    },
    sheetFooter: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      borderTopWidth: 1,
    },
    sendBtnGradient: {
      height: 50,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    sendBtnGradInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
    },
    sendBtnText: { fontFamily: FONTS.headlineMd, fontSize: 15, fontWeight: '700' },
  });
}
