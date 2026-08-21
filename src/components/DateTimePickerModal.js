import React, { useState, useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n) => String(n).padStart(2, '0');

const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isBeforeDay = (a, b) =>
  new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() <
  new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();

export default function DateTimePickerModal({
  visible,
  mode = 'date', // 'date' | 'time'
  value,
  onChange,
  onClose,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => {
    const d = value instanceof Date ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selDate, setSelDate] = useState(value instanceof Date ? new Date(value) : new Date());
  const [selHour, setSelHour] = useState(value instanceof Date ? value.getHours() : 9);
  const [selMinute, setSelMinute] = useState(value instanceof Date ? value.getMinutes() : 0);

  const open = !!visible;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const [ampm, setAmpm] = useState(selHour >= 12 ? 'PM' : 'AM');

  const stepHour = (delta) => {
    let next = selHour + delta;
    let nextAmpm = ampm;
    if (selHour === 11 && delta > 0) { next = 12; nextAmpm = ampm === 'AM' ? 'PM' : 'AM'; }
    else if (selHour === 12 && delta > 0) { next = 1; }
    else if (selHour === 12 && delta < 0) { next = 11; nextAmpm = ampm === 'AM' ? 'PM' : 'AM'; }
    else if (selHour === 1 && delta < 0) { next = 12; }
    setSelHour(next);
    setAmpm(nextAmpm);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const confirm = () => {
    let result;
    if (mode === 'date') {
      result = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate());
    } else {
      let h = selHour;
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      result = new Date();
      result.setHours(h, selMinute, 0, 0);
    }
    onChange(result);
  };

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
              {mode === 'date' ? 'Select Date' : 'Select Time'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {mode === 'date' ? (
            <>
              <View style={styles.calNav}>
                <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
                  <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.onSurface }]}>{monthLabel}</Text>
                <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
                  <MaterialIcons name="chevron-right" size={22} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} style={[styles.weekLabel, { color: colors.onSurfaceVariant }]}>{d}</Text>
                ))}
              </View>

              <View style={styles.dayGrid}>
                {cells.map((day, i) => {
                  if (day == null) return <View key={i} style={styles.dayCell} />;
                  const date = new Date(year, month, day);
                  const selected = isSameDay(date, selDate);
                  const isToday = isSameDay(date, today);
                  const past = isBeforeDay(date, today);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayCell, selected && { backgroundColor: colors.primaryContainer }]}
                      onPress={() => setSelDate(date)}
                      disabled={past}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: selected ? colors.onPrimaryContainer : colors.onSurface },
                          isToday && !selected && { color: colors.primary, fontWeight: '700' },
                          past && { color: colors.outlineVariant },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.timeBody}>
              <View style={[styles.digitalClock, { backgroundColor: colors.surfaceVariant }]}>
                <View style={styles.clockUnit}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={() => stepHour(1)}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                  <Text style={[styles.clockDigit, { color: colors.onSurface }]}>{selHour % 12 === 0 ? 12 : selHour % 12}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={() => stepHour(-1)}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.clockColon, { color: colors.onSurface }]}>:</Text>
                <View style={styles.clockUnit}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={() => setSelMinute((selMinute + 5) % 60)}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                  <Text style={[styles.clockDigit, { color: colors.onSurface }]}>{pad(selMinute)}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={() => setSelMinute((selMinute - 5 + 60) % 60)}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
                <View style={styles.ampmWrap}>
                  {['AM', 'PM'].map(a => {
                    const active = ampm === a;
                    return (
                      <TouchableOpacity
                        key={a}
                        style={[
                          styles.ampmBtn,
                          active
                            ? { backgroundColor: colors.primaryContainer }
                            : { backgroundColor: colors.surfaceContainerLow },
                        ]}
                        onPress={() => setAmpm(a)}
                      >
                        <Text style={[styles.ampmText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                          {a}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceVariant }]} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.okBtn, { backgroundColor: colors.primaryContainer }]} onPress={confirm}>
              <Text style={[styles.okText, { color: colors.onPrimaryContainer }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 18,
      padding: 18,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerTitle: { fontFamily: FONTS.headlineMd, fontSize: 16, fontWeight: '700' },
    closeBtn: { padding: 4 },
    calNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
    },
    monthLabel: { fontFamily: FONTS.headlineMd, fontSize: 15, fontWeight: '600' },
    weekRow: { flexDirection: 'row', marginBottom: 6 },
    weekLabel: {
      flex: 1,
      textAlign: 'center',
      fontFamily: FONTS.labelMd,
      fontSize: 11,
      textTransform: 'uppercase',
    },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: `${100 / 7}%`,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    dayText: { fontFamily: FONTS.bodyMd, fontSize: 14 },
    timeWrap: { maxHeight: 320 },
    timeContent: { paddingVertical: 4 },
    timeBody: { paddingVertical: 8 },
    digitalClock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      borderRadius: 16,
      paddingVertical: 22,
      paddingHorizontal: 16,
    },
    clockUnit: {
      alignItems: 'center',
      gap: 10,
    },
    stepBtn: {
      width: 40,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clockDigit: {
      fontFamily: FONTS.headlineMd,
      fontSize: 44,
      fontWeight: '700',
      minWidth: 64,
      textAlign: 'center',
    },
    clockColon: { fontFamily: FONTS.headlineMd, fontSize: 40, fontWeight: '700' },
    ampmWrap: {
      alignSelf: 'center',
      gap: 8,
      marginLeft: 8,
    },
    ampmBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
    },
    ampmText: { fontFamily: FONTS.labelMd, fontSize: 12, fontWeight: '700' },
    footer: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelText: { fontFamily: FONTS.labelMd, fontSize: 14, fontWeight: '600' },
    okBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    okText: { fontFamily: FONTS.labelMd, fontSize: 14, fontWeight: '700' },
  });
}
