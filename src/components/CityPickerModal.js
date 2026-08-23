import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COUNTRIES } from '../lib/cities';
import { useLocale } from '../i18n/LocaleContext';

export default function CityPickerModal({ visible, onClose, onSelect, onClear }) {
  const { t } = useLocale();
  const [country, setCountry] = useState(null);

  useEffect(() => {
    if (visible) setCountry(null);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

      <View style={styles.sheet}>
        <View style={styles.header}>
          {country ? (
            <TouchableOpacity onPress={() => setCountry(null)} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Text style={styles.title}>
            {country ? `${country.flag} ${country.name}` : t('chooseCountry')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <MaterialIcons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {!country && (
            <>
              <TouchableOpacity
                style={[styles.row, styles.rowAccent]}
                onPress={() => {
                  onClear && onClear();
                  onClose();
                }}
              >
                <MaterialIcons name="public" size={20} color="#8B7CF6" />
                <Text style={[styles.rowText, styles.rowTextAccent]}>{t('allCities')}</Text>
              </TouchableOpacity>
              {COUNTRIES.map(c => (
                <TouchableOpacity key={c.code} style={styles.row} onPress={() => setCountry(c)}>
                  <Text style={styles.flag}>{c.flag}</Text>
                  <Text style={styles.rowText}>{c.name}</Text>
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ))}
            </>
          )}

          {country && (
            <>
              <Text style={styles.sectionLabel}>{t('chooseCity')}</Text>
              {country.cities.map(city => (
                <TouchableOpacity
                  key={city}
                  style={styles.row}
                  onPress={() => {
                    onSelect(city);
                    onClose();
                  }}
                >
                  <MaterialIcons name="location-city" size={18} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.rowText}>{city}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1C1B1F',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  list: { paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowAccent: { backgroundColor: 'rgba(139,124,246,0.14)', marginTop: 8 },
  flag: { fontSize: 20 },
  rowText: {
    flex: 1,
    color: '#E6E1E5',
    fontSize: 15,
  },
  rowTextAccent: { color: '#8B7CF6', fontWeight: '600' },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 4,
  },
});
