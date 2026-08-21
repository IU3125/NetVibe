import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Platform, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';
import { supabase } from '../../lib/supabase';
import DateTimePickerModal from '../../components/DateTimePickerModal';

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

const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'];
const CURRENCIES = ['USD', 'AZN', 'TRY', 'EUR', 'GBP'];
const PERIODS = ['hour', 'week', 'month', 'year'];

export default function CreateJobScreen({ onBack, onCreated }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('it');
  const [type, setType] = useState('Full-Time');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('AZN');
  const [period, setPeriod] = useState('month');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [perks, setPerks] = useState('');
  const [workHoursStart, setWorkHoursStart] = useState(null);
  const [workHoursEnd, setWorkHoursEnd] = useState(null);
  const [applyBefore, setApplyBefore] = useState(null);
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);

  const toArray = (text) =>
    text.split('\n').map(s => s.trim()).filter(Boolean);

  const formatDate = (d) => d ? d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const formatTime = (d) => d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  const submit = async () => {
    if (!title.trim() || !company.trim() || !location.trim()) {
      Alert.alert(t('error'), t('fillRequired'));
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const num = (v) => (v === '' || v == null ? null : Number(v));

      let applyDate = null;
      if (applyBefore instanceof Date && !isNaN(applyBefore)) {
        applyDate = applyBefore.toISOString().slice(0, 10);
      }
      let workHoursText = null;
      if (workHoursStart instanceof Date && !isNaN(workHoursStart)) {
        workHoursText = formatTime(workHoursStart) + ' - ' + (workHoursEnd instanceof Date && !isNaN(workHoursEnd) ? formatTime(workHoursEnd) : '');
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: title.trim(),
          company: company.trim(),
          category,
          type,
          salary_min: num(salaryMin),
          salary_max: num(salaryMax),
          currency,
          period,
          location: location.trim(),
          city: city.trim() || 'Dhaka',
          description: description.trim() || null,
          responsibilities: toArray(responsibilities),
          qualifications: toArray(qualifications),
          perks: toArray(perks),
          work_hours: workHoursText,
          apply_before: applyDate,
          employer_id: user.id,
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) throw error;
      if (onCreated) onCreated(data);
      else {
        Alert.alert(t('jobPosted'), t('jobPendingApproval'), [{ text: 'OK', onPress: onBack }]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert(t('error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Post a Job</Text>
        </View>
        <TouchableOpacity
          style={[styles.postButton, { backgroundColor: colors.primaryContainer }]}
          onPress={submit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
          ) : (
            <Text style={[styles.postText, { color: colors.onPrimaryContainer }]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrap}>
          <View style={styles.pendingNote}>
            <MaterialIcons name="verified-user" size={20} color={colors.tertiary} />
            <Text style={[styles.pendingNoteText, { color: colors.onSurfaceVariant }]}>
              {t('jobPendingNote')}
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>{t('jobDetails').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('jobTitleLabel')}</Text>
              <TextInput
                style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Senior React Native Developer"
                placeholderTextColor={colors.outlineVariant}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('company')}</Text>
              <TextInput
                style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={company}
                onChangeText={setCompany}
                placeholder="e.g. NetVibe Technologies"
                placeholderTextColor={colors.outlineVariant}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('location')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Baku, Azerbaijan"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('city')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Baku"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>{t('category').toUpperCase()}</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map(cat => {
              const active = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer }
                      : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '44' },
                  ]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text style={[styles.chipText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>{t('employmentType').toUpperCase()}</Text>
          <View style={styles.chipWrap}>
            {TYPES.map(tp => {
              const active = type === tp;
              return (
                <TouchableOpacity
                  key={tp}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer }
                      : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '44' },
                  ]}
                  onPress={() => setType(tp)}
                >
                  <Text style={[styles.chipText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                    {tp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>{t('salary').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={styles.row}>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('min')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={salaryMin}
                  onChangeText={setSalaryMin}
                  placeholder="500"
                  keyboardType="numeric"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('max')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={salaryMax}
                  onChangeText={setSalaryMax}
                  placeholder="1200"
                  keyboardType="numeric"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('currency')}</Text>
                <View style={styles.selectWrap}>
                  {CURRENCIES.map(c => {
                    const active = currency === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[styles.selectPill, active ? { backgroundColor: colors.primaryContainer } : {}]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[styles.selectText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('period')}</Text>
                <View style={styles.selectWrap}>
                  {PERIODS.map(p => {
                    const active = period === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.selectPill, active ? { backgroundColor: colors.primaryContainer } : {}]}
                        onPress={() => setPeriod(p)}
                      >
                        <Text style={[styles.selectText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>{t('description').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('jobDescription')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the role..."
                placeholderTextColor={colors.outlineVariant}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('responsibilities')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={responsibilities}
                onChangeText={setResponsibilities}
                placeholder="One per line"
                placeholderTextColor={colors.outlineVariant}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('qualifications')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={qualifications}
                onChangeText={setQualifications}
                placeholder="One per line"
                placeholderTextColor={colors.outlineVariant}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('perks')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                value={perks}
                onChangeText={setPerks}
                placeholder="One per line"
                placeholderTextColor={colors.outlineVariant}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('workHours')}</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.input, styles.pickerBtn, styles.pickerBtnFlex, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setPicker('workStart')}
                >
                  <MaterialIcons name="schedule" size={18} color={colors.primary} />
                  <Text style={{ color: workHoursStart ? colors.onSurface : colors.outlineVariant, fontFamily: FONTS.bodyMd, fontSize: 14 }}>
                    {workHoursStart ? formatTime(workHoursStart) : 'Start'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.pickerDash, { color: colors.onSurfaceVariant }]}>–</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickerBtn, styles.pickerBtnFlex, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setPicker('workEnd')}
                >
                  <MaterialIcons name="schedule" size={18} color={colors.primary} />
                  <Text style={{ color: workHoursEnd ? colors.onSurface : colors.outlineVariant, fontFamily: FONTS.bodyMd, fontSize: 14 }}>
                    {workHoursEnd ? formatTime(workHoursEnd) : 'End'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('applyBefore')}</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerBtn, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                onPress={() => setPicker('date')}
              >
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                <Text style={{ color: applyBefore ? colors.onSurface : colors.outlineVariant, fontFamily: FONTS.bodyMd, fontSize: 14 }}>
                  {applyBefore ? formatDate(applyBefore) : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <DateTimePickerModal
          visible={!!picker}
          mode={picker === 'date' ? 'date' : 'time'}
          value={picker === 'date' ? applyBefore : picker === 'workStart' ? workHoursStart : workHoursEnd}
          onChange={(d) => {
            if (picker === 'date') setApplyBefore(d);
            else if (picker === 'workStart') setWorkHoursStart(d);
            else if (picker === 'workEnd') setWorkHoursEnd(d);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backButton: { padding: 6 },
    topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, fontWeight: '700' },
    postButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    postText: { fontFamily: FONTS.labelMd, fontSize: 13, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 80 },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center' },
    pendingNote: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.surfaceContainerLow, borderRadius: 12,
      padding: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.outlineVariant + '33',
    },
    pendingNoteText: { fontFamily: FONTS.bodyMd, fontSize: 13, flex: 1 },
    sectionLabel: {
      fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '600',
      letterSpacing: 1.2, marginBottom: 10, marginTop: 20,
    },
    card: { borderRadius: 16, padding: 14, gap: 12, marginBottom: 8 },
    field: { gap: 6 },
    fieldHalf: { gap: 6 },
    label: { fontFamily: FONTS.labelMd, fontSize: 12 },
    input: {
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: FONTS.bodyMd, fontSize: 14,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      justifyContent: 'flex-start',
    },
    pickerBtnFlex: { flex: 1 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pickerDash: { fontFamily: FONTS.bodyMd, fontSize: 14 },
    textArea: {
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: FONTS.bodyMd, fontSize: 14, minHeight: 80,
    },
    row: { flexDirection: 'row', gap: 10 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1,
    },
    chipText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    selectWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    selectPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    selectText: { fontFamily: FONTS.labelMd, fontSize: 12 },
  });
}
