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

export default function FollowersScreen({ profileId, onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    loadFollowers();
  }, [profileId]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      const targetId = profileId || currentUserId;
      if (!targetId) return;

      const { data: follows, error } = await supabase
        .from('followers')
        .select('follower_id, created_at')
        .eq('following_id', targetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!follows?.length) { setFollowers([]); setLoading(false); return; }

      const followerIds = follows.map(f => f.follower_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', followerIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const dateMap = {};
      follows.forEach(f => { dateMap[f.follower_id] = f.created_at; });

      let mutualIds = [];
      if (currentUserId) {
        const { data: mutuals } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('following_id', currentUserId)
          .in('follower_id', followerIds);
        mutualIds = new Set((mutuals || []).map(m => m.follower_id));
      }

      const list = followerIds.map(id => ({
        id,
        ...(profileMap[id] || { username: id, full_name: '' }),
        created_at: dateMap[id],
        isMutual: mutualIds.has(id),
      }));

      setFollowers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFollower = async (followerId) => {
    try {
      const targetId = profileId || currentUserId;
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', targetId);
      setFollowers(prev => prev.filter(f => f.id !== followerId));
    } catch {}
  };

  const followBack = async (followerId) => {
    try {
      await supabase
        .from('followers')
        .insert({ follower_id: currentUserId, following_id: followerId });
      setFollowers(prev => prev.map(f =>
        f.id === followerId ? { ...f, isMutual: true } : f
      ));
    } catch {}
  };

  const filtered = useMemo(() => {
    let list = followers;
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
  }, [followers, search, activeFilter]);

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.username}>@{item.username || item.id}</Text>
            </View>
            {item.full_name ? (
              <Text style={styles.fullName}>{item.full_name}</Text>
            ) : null}
          </View>
        </View>
        {!profileId || profileId === currentUserId ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.isMutual
                ? { backgroundColor: colors.primaryContainer }
                : { backgroundColor: colors.surfaceContainerHigh },
            ]}
            onPress={() => item.isMutual ? removeFollower(item.id) : followBack(item.id)}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: item.isMutual ? colors.onPrimaryContainer : colors.onSurface },
              ]}
            >
              {item.isMutual ? 'Remove' : 'Follow back'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.divider} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.primary }]}>{t('followersList')}</Text>
        </View>
      </View>

      <View style={styles.searchArea}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search followers..."
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
                {f === 'all' ? `All ${formatCount(followers.length)}` : t(f)}
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
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.onSurfaceVariant }}>No followers found</Text>
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
  });
}
