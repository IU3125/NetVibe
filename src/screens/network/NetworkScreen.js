import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
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

export default function NetworkScreen({ onViewProfile }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);

  const [userId, setUserId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    loadAll();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const loadAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    await Promise.all([
      loadFollowed(user.id),
      loadSuggestions(user.id),
      loadActiveUsers(user.id),
    ]);
    setLoading(false);
  };

  const loadFollowed = async (me) => {
    try {
      const { data } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', me);
      setFollowedIds(new Set((data || []).map((f) => f.following_id)));
    } catch {}
  };

  const loadSuggestions = async (me) => {
    try {
      const { data, error } = await supabase.rpc('get_suggestions', { limit_n: 10 });
      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    }
  };

  const loadActiveUsers = async (me) => {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('user_id')
        .limit(400);
      if (error) throw error;
      const counts = {};
      (posts || []).forEach((p) => {
        if (p.user_id !== me) counts[p.user_id] = (counts[p.user_id] || 0) + 1;
      });
      const topIds = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 10);
      if (!topIds.length) { setActiveUsers([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, job_title')
        .in('id', topIds);

      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p; });
      setActiveUsers(
        topIds.map((id) => ({
          id,
          ...(map[id] || { username: id, full_name: '', avatar_url: null, job_title: null }),
          postCount: counts[id],
        }))
      );
    } catch (err) {
      console.error(err);
      setActiveUsers([]);
    }
  };

  useEffect(() => {
    const q = search.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, job_title')
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%,job_title.ilike.%${q}%`)
          .neq('id', userId)
          .limit(20);
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, userId]);

  const toggleFollow = async (targetId) => {
    const isFollowed = followedIds.has(targetId);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (isFollowed) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
    try {
      if (isFollowed) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', targetId);
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: userId, following_id: targetId });
      }
    } catch {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (isFollowed) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    }
  };

  const renderUser = (item) => {
    const isFollowing = followedIds.has(item.id);
    const subtitle = item.job_title
      ? item.job_title
      : item.mutual > 0
        ? `${item.mutual} ${t('mutuals')}`
        : item.postCount
          ? `${formatCount(item.postCount)} ${t('posts')}`
          : null;
    return (
      <View key={item.id}>
        <TouchableOpacity
          style={styles.userRow}
          activeOpacity={0.7}
          onPress={() => onViewProfile && onViewProfile(item.id)}
        >
          <View style={styles.userRowLeft}>
            <View style={styles.avatar}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
              ) : (
                <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.username} numberOfLines={1}>@{item.username || item.id}</Text>
              {item.full_name ? (
                <Text style={styles.fullName} numberOfLines={1}>{item.full_name}</Text>
              ) : null}
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.followBtn,
              { backgroundColor: isFollowing ? colors.surfaceContainerHigh : colors.primary },
            ]}
            onPress={() => toggleFollow(item.id)}
          >
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowing ? colors.onSurface : colors.onPrimary },
              ]}
            >
              {isFollowing ? t('followingLabel') : t('follow')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
        <View style={styles.divider} />
      </View>
    );
  };

  const renderEmpty = (message) => (
    <View style={styles.emptyWrap}>
      <MaterialIcons name="people-outline" size={40} color={colors.onSurfaceVariant} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const hasSearch = search.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.topTitle, { color: colors.primary }]}>{t('network')}</Text>
      </View>

      <View style={styles.searchArea}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder={t('networkSearch')}
            placeholderTextColor={colors.onSurfaceVariant}
            value={search}
            onChangeText={setSearch}
          />
          {hasSearch ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadAll();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {hasSearch ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{t('searchResults')}</Text>
              {searchResults.length ? searchResults.map(renderUser) : renderEmpty(t('noUsersFound'))}
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{t('suggestedForYou')}</Text>
              {suggestions.length ? suggestions.map(renderUser) : renderEmpty(t('noSuggestions'))}

              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{t('mostActive')}</Text>
              {activeUsers.length ? activeUsers.map(renderUser) : renderEmpty(t('noUsersFound'))}
            </>
          )}
        </ScrollView>
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
    sectionTitle: {
      fontFamily: FONTS.headlineMd,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 16,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
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
    subtitle: { fontFamily: FONTS.bodyMd, fontSize: 13, color: colors.primary, marginTop: 1 },
    followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    followBtnText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    divider: { height: 1, marginHorizontal: 16, backgroundColor: colors.outlineVariant + '20' },
    centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', padding: 32, gap: 10 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant },
  });
}
