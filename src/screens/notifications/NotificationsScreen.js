import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

const AVATAR_1 = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtj-qcmnbbRZe1UzqA6EsYeq1JyxUYgieCi_1_nXdXBL_8uJRVulxY-nbahEKXzpuBlSg0NR1wgHZFL72KH-HCYK-tPCZZ8de4Wai88i2VSuJank4pI3fFgWk_G4Q6HWmCO-LQjzgvFK7dR4riheceH9bRgLlUNlxOLilO0rrJ6ugvcHAsMCUb6QxSEfeFnV7XbyeDl4bRULp5q70hbORTwRDhnjrG-dipRYo0ITs8KzNAkRpGGQyUKP-9xl--ljzpX6nXfNatMyw';
const AVATAR_2 = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAJa7kQ5TSeRNkSqaNlhk5xlPlPvlGqTJYbAAcqvlG_z1g-SfU386qwFPeyY4aT-rdqLl07bNiN3ZC3ZuBkAZ4agRM7XHxo_Dmhu5SYSXKN5Rl60vNWNHFjpkVLfMSbhvfpU4hdnsNOQl2SgwTuECYBUomdFRvrsTVEEiPo2ef6M_-aDdF0iqZ9LuD0I1mCboYMD-OhOvQsKCUvx-3YVx4kiuzSxoJF7SGdBm4zIfM9N6nIFkMktzfMQYDZ57BAgn_Unzn8Qn8R0Q';
const AVATAR_3 = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDN4R1KKSppaq8B3F8DwbMJ-Cj59HTDw_CDWUPwNoilVN1kriwaFOwAfrG0kuG40O-mpu8G10BkIn2Vwr-B7Jmkej_lpsqBIe50D1PZGVAcbIXodElgj_ch9TkQYweWsM3WtampNNQens62pddywn8zGMa4zii9CUMG2ghhGv4VTz5dsKm4x3hqka0yq6bcBfKdAEdO9auSqzBlLUDXy9Xuml6_1RTS-_kM4MsF1Dibs7ujkbOIES_L81JEcRjVafZSumTlk0ybYNI';

const NOTIFICATIONS = [
  {
    id: '1',
    section: 'Today',
    time: '2h ago',
    type: 'profile_view',
    bold: 'Watson D.',
    text: ' viewed your profile',
    action: { label: 'See all view', variant: 'filled' },
    avatar: AVATAR_1,
    unread: true,
  },
  {
    id: '2',
    section: 'Today',
    time: '5h ago',
    type: 'follow',
    bold: 'Athan Alexand',
    text: ' followed you',
    action: { label: 'Follow Back', variant: 'outline' },
    avatar: AVATAR_2,
    unread: false,
  },
  {
    id: '3',
    section: 'Today',
    time: '8h ago',
    type: 'celebration',
    icon: 'celebration',
    iconBg: 'secondaryContainer',
    bold: 'Adiel matthew',
    text: ' for his new position as a Designer',
    prefix: 'Congratulate your friend ',
    unread: false,
  },
  {
    id: '4',
    section: 'Yesterday',
    time: '1d ago',
    type: 'event',
    bold: 'John Seba',
    text: ' is attending in graphic Design event that will held on tomorrow on 3:30 pm on town hall.',
    avatar: AVATAR_3,
    unread: false,
    dimmed: true,
  },
  {
    id: '5',
    section: 'Yesterday',
    time: '1d ago',
    type: 'community',
    icon: 'groups',
    iconBg: 'surfaceHighest',
    bold: 'UI/UX Designer Community',
    text: 'New activity in ',
    sub: '"32 new posts since your last visit"',
    unread: false,
    dimmed: true,
  },
];

export default function NotificationsScreen({ onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [items, setItems] = useState(NOTIFICATIONS);
  const [following, setFollowing] = useState({});

  const sections = useMemo(() => {
    const map = {};
    items.forEach(item => {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    });
    return Object.keys(map).map(name => ({ name, rows: map[name] }));
  }, [items]);

  const markRead = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, unread: false } : i));
  };

  const markAllRead = () => {
    setItems(prev => prev.map(i => ({ ...i, unread: false })));
  };

  const toggleFollow = (id) => {
    setFollowing(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderAction = (item) => {
    if (!item.action) return null;
    const isFollowing = item.type === 'follow' && following[item.id];
    const label = isFollowing ? 'Following' : item.action.label;
    if (item.action.variant === 'filled') {
      return (
        <TouchableOpacity
          style={[styles.actionFilled, { backgroundColor: colors.primaryContainer }]}
          activeOpacity={0.85}
          onPress={() => { markRead(item.id); }}
        >
          <Text style={[styles.actionFilledText, { color: colors.onPrimaryContainer }]}>{label}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.actionOutline, { borderColor: colors.primary }, isFollowing && { borderColor: colors.surfaceVariant }]}
        activeOpacity={0.85}
        onPress={() => { markRead(item.id); if (item.type === 'follow') toggleFollow(item.id); }}
      >
        <Text style={[styles.actionOutlineText, { color: isFollowing ? colors.onSurfaceVariant : colors.primary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderLeading = (item) => {
    if (item.icon) {
      const bg = item.iconBg === 'secondaryContainer' ? colors.secondaryContainer : colors.surfaceContainerHighest;
      const tint = item.iconBg === 'secondaryContainer' ? colors.onSecondaryContainer : colors.primary;
      return (
        <View style={[styles.leadingIcon, { backgroundColor: bg }]}>
          <MaterialIcons name={item.icon} size={24} color={tint} />
        </View>
      );
    }
    return (
      <View style={[styles.leadingAvatar, { borderColor: colors.outlineVariant }]}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.leadingImg} />
        ) : (
          <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
        )}
      </View>
    );
  };

  const renderBody = (item) => (
    <View style={styles.itemBody}>
      <View style={styles.itemTop}>
        <Text style={[styles.itemText, { color: colors.onSurface }]}>
          {item.prefix}
          {item.bold && <Text style={styles.itemBold}>{item.bold}</Text>}
          {item.text}
        </Text>
        <Text style={[styles.itemTime, { color: colors.onSurfaceVariant }]}>{item.time}</Text>
      </View>
      {item.sub ? (
        <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]}>{item.sub}</Text>
      ) : null}
      {renderAction(item)}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.primary }]}>Social Mate</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="notifications" size={22} color={colors.primary} />
            <View style={[styles.headerDot, { backgroundColor: colors.secondary }]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrap}>
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Notifications</Text>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markAll}>Mark all as read</Text>
            </TouchableOpacity>
          </View>

          {sections.map(section => (
            <View key={section.name} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                {section.name.toUpperCase()}
              </Text>
              <View style={{ gap: 8 }}>
                {section.rows.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      { backgroundColor: colors.surfaceContainer, borderColor: 'rgba(255,255,255,0.05)' },
                      item.dimmed && styles.itemDimmed,
                    ]}
                    activeOpacity={0.9}
                    onPress={() => markRead(item.id)}
                  >
                    {renderLeading(item)}
                    {renderBody(item)}
                    {item.unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      paddingBottom: 8, paddingHorizontal: 8,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    backBtn: { padding: 8 },
    topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, flex: 1 },
    topBarRight: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { padding: 8, position: 'relative' },
    headerDot: {
      position: 'absolute', top: 6, right: 6,
      width: 8, height: 8, borderRadius: 4,
    },
    content: { padding: 16, paddingBottom: 120 },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 24 },
    pageHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    pageTitle: { fontFamily: FONTS.headlineLg, fontSize: 24, lineHeight: 32, fontWeight: '700' },
    markAll: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.primary },
    section: { gap: 16 },
    sectionTitle: {
      fontFamily: FONTS.labelMd, fontSize: 12, letterSpacing: 1.5,
      textTransform: 'uppercase', paddingLeft: 4,
    },
    itemCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 16,
      padding: 16, borderRadius: 12, borderWidth: 1,
    },
    itemDimmed: { opacity: 0.8 },
    leadingAvatar: {
      width: 48, height: 48, borderRadius: 24,
      borderWidth: 1, overflow: 'hidden',
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center', alignItems: 'center',
    },
    leadingImg: { width: '100%', height: '100%' },
    leadingIcon: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center',
    },
    itemBody: { flex: 1, gap: 4 },
    itemTop: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: 8,
    },
    itemText: { fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 20, flex: 1 },
    itemBold: { fontFamily: FONTS.bodyLg, fontSize: 14, fontWeight: '700' },
    itemTime: { fontFamily: FONTS.bodyMd, fontSize: 12, color: colors.onSurfaceVariant },
    itemSub: { fontFamily: FONTS.bodyMd, fontSize: 12, fontStyle: 'italic' },
    unreadDot: {
      width: 8, height: 8, borderRadius: 4,
      marginTop: 8,
    },
    actionFilled: {
      alignSelf: 'flex-start', marginTop: 8,
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    },
    actionFilledText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    actionOutline: {
      alignSelf: 'flex-start', marginTop: 8,
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1,
    },
    actionOutlineText: { fontFamily: FONTS.labelMd, fontSize: 12 },
  });
}
