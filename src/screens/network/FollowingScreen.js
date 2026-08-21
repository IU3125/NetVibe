import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';

const formatCount = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
};

const filters = ['all', 'mutuals', 'recent'];

export default function FollowingScreen({ profileId, onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [following, setFollowing] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadData(user.id);
      }
    });
  }, [profileId]);

  const loadData = async (uid) => {
    setLoading(true);
    try {
      const targetId = profileId || uid;
      if (!targetId) return;

      const { data: follows, error } = await supabase
        .from('followers')
        .select('following_id, created_at')
        .eq('follower_id', targetId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const followingIds = (follows || []).map(f => f.following_id);

      let profiles = [];
      if (followingIds.length > 0) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', followingIds);
        profiles = pData || [];
      }

      const profileMap = {};
      profiles.forEach(p => { profileMap[p.id] = p; });

      const dateMap = {};
      (follows || []).forEach(f => { dateMap[f.following_id] = f.created_at; });

      let mutualIds = new Set();
      if (uid && followingIds.length > 0) {
        const { data: mutuals } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('following_id', uid)
          .in('follower_id', followingIds);
        mutualIds = new Set((mutuals || []).map(m => m.follower_id));
      }

      const list = followingIds.map(id => ({
        id,
        ...(profileMap[id] || { username: id, full_name: '' }),
        created_at: dateMap[id],
        isMutual: mutualIds.has(id),
      }));

      setFollowing(list);

      let suggestedList = [];
      if (!profileId || profileId === uid) {
        let query = supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .neq('id', uid);
        if (followingIds.length > 0) {
          query = query.not('id', 'in', `(${followingIds.join(',')})`);
        }
        const { data: sData } = await query.limit(10);
        suggestedList = (sData || []).map(p => ({
          ...p,
          following: false,
        }));
      }
      setSuggested(suggestedList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const unfollow = async (followingId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId);
      setFollowing(prev => prev.filter(f => f.id !== followingId));
      setSuggested(prev => [...prev, { id: followingId, following: false }]);
    } catch {}
  };

  const followSuggested = async (suggestedId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('followers')
        .insert({ follower_id: user.id, following_id: suggestedId });
      setSuggested(prev => prev.filter(s => s.id !== suggestedId));
    } catch {}
  };

  const filtered = useMemo(() => {
    let list = following;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        (f.username || '').toLowerCase().includes(q) ||
        (f.full_name || '').toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'mutuals') {
      list = list.filter(f => f.isMutual);
    } else if (activeFilter === 'recent') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [following, search, activeFilter]);

  const renderItem = ({ item }) => (
    <View>
      <View style={styles.userRow}>
        <View style={styles.userRowLeft}>
          <View style={styles.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
            )}
          </View>
          <View>
            <Text style={styles.username}>@{item.username || item.id}</Text>
            {item.full_name ? (
              <Text style={styles.fullName}>{item.full_name}</Text>
            ) : null}
          </View>
        </View>
        {(!profileId || profileId === currentUserId) && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primaryContainer }]}
            onPress={() => unfollow(item.id)}
          >
            <Text style={[styles.actionBtnText, { color: colors.onPrimaryContainer }]}>
              {t('followingLabel')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.divider} />
    </View>
  );

  const renderSuggestedHeader = () => {
    if (suggested.length === 0 || (profileId && profileId !== currentUserId)) return null;
    return (
      <View style={styles.suggestedSection}>
        <Text style={styles.suggestedTitle}>{t('suggestedForYou')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
          {suggested.map((s) => (
            <View key={s.id} style={[styles.suggestedCard, { backgroundColor: colors.surfaceContainerLow }]}>
              <View style={styles.suggestedAvatar}>
                {s.avatar_url ? (
                  <Image source={{ uri: s.avatar_url }} style={styles.suggestedAvatarImage} />
                ) : (
                  <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
                )}
              </View>
              <Text style={styles.suggestedName} numberOfLines={1}>{s.full_name || s.username}</Text>
              <Text style={styles.suggestedUsername} numberOfLines={1}>@{s.username}</Text>
              <TouchableOpacity
                style={[styles.suggestedFollowBtn, { backgroundColor: colors.primary }]}
                onPress={() => followSuggested(s.id)}
              >
                <Text style={[styles.suggestedFollowText, { color: colors.onPrimary }]}>
                  {t('follow')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.primary }]}>{t('followingList')}</Text>
        </View>
      </View>

      <View style={styles.searchArea}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder={t('searchFollowing')}
            placeholderTextColor={colors.onSurfaceVariant}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                activeFilter === f
                  ? { backgroundColor: colors.primaryContainer }
                  : { backgroundColor: colors.surfaceContainerHigh },
              ]}
              onPress={() => setActiveFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activeFilter === f ? colors.onPrimaryContainer : colors.onSurfaceVariant },
                ]}
              >
                {f === 'all' ? `All ${formatCount(following.length)}` : t(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderSuggestedHeader}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.onSurfaceVariant }}>{t('noFollowing')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function getStyles(colors, FONTS) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    backButton: { padding: 4 },
    topTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, fontWeight: '600' },
    searchArea: { paddingHorizontal: 16, paddingVertical: 12 },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48,
      gap: 8,
    },
    searchInput: { flex: 1, fontFamily: FONTS.bodyLg, fontSize: 16 },
    filterRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    filterChipText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    userRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    avatarImage: { width: '100%', height: '100%' },
    username: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface },
    fullName: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginTop: 1 },
    actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    actionBtnText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    divider: { height: 1, marginHorizontal: 16, backgroundColor: colors.outlineVariant + '20' },
    suggestedSection: { paddingTop: 24, paddingBottom: 8 },
    suggestedTitle: {
      fontFamily: FONTS.bodyLg,
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    suggestedScroll: { paddingHorizontal: 12, gap: 12 },
    suggestedCard: {
      width: 140,
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant + '20',
    },
    suggestedAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary + '33',
      marginBottom: 10,
    },
    suggestedAvatarImage: { width: '100%', height: '100%' },
    suggestedName: {
      fontFamily: FONTS.labelMd,
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurface,
      textAlign: 'center',
      maxWidth: 120,
    },
    suggestedUsername: {
      fontFamily: FONTS.labelMd,
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginBottom: 10,
      textAlign: 'center',
      maxWidth: 120,
    },
    suggestedFollowBtn: {
      width: '100%',
      paddingVertical: 6,
      borderRadius: 20,
      alignItems: 'center',
    },
    suggestedFollowText: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '700' },
  });
}
