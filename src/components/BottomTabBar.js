import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../constants/theme';
import { useLocale } from '../i18n/LocaleContext';
import { useTheme } from '../contexts/ThemeContext';

const tabDefs = [
  { key: 'home', icon: 'home' },
  { key: 'discover', icon: 'explore' },
  { key: 'vacancies', icon: 'work' },
  { key: 'network', icon: 'group' },
  { key: 'profile', icon: 'account-circle' },
];

const adminTabDef = { key: 'admin', icon: 'admin-panel-settings' };

export default function BottomTabBar({ activeTab, onTabPress, isAdmin }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const tabs = isAdmin ? [...tabDefs.slice(0, 3), adminTabDef, ...tabDefs.slice(3)] : tabDefs;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => onTabPress(tab.key)}
          >
            <MaterialIcons
              name={tab.icon}
              size={22}
              color={isActive ? colors.primary : colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary : colors.onSurfaceVariant },
              ]}
            >
              {t(tab.key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontFamily: FONTS.labelMd,
    fontSize: 9,
    fontWeight: '500',
  },
});
