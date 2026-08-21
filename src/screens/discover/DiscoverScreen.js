import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocale } from '../../i18n/LocaleContext';

const FILTERS = [
  { key: 'all', label: 'All Results' },
  { key: 'people', label: 'People' },
  { key: 'communities', label: 'Communities' },
  { key: '#photography', label: '#Photography' },
  { key: '#design', label: '#Design' },
];

const formatMembers = (n) => {
  const count = Number(n || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M members`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k members`;
  return `${count} members`;
};

export default function DiscoverScreen({ onViewPost, onViewCommunity }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 600) - 32;
  const cardSize = (contentWidth - 16) / 2;
  const itemSize = (contentWidth - 8) / 2;

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [communityResults, setCommunityResults] = useState([]);
  const [hashtagResults, setHashtagResults] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [joinedMap, setJoinedMap] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [followMap, setFollowMap] = useState({});
  const [tagPosts, setTagPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTrending = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_trending_hashtags', { limit_n: 8 });
      if (error) throw error;
      setTrending(data || []);
    } catch (err) {
      console.error(err);
      setTrending([]);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_suggestions', { limit_n: 10 });
      if (error) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, job_title')
          .neq('id', user?.id)
          .limit(10);
        setSuggestions(profiles || []);
        return;
      }
      setSuggestions(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadCommunities = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: rows, error } = await supabase
        .from('communities')
        .select('*, community_members(count)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const list = (rows || []).map(c => ({
        ...c,
        member_count: c.community_members?.[0]?.count || 0,
      }));
      setCommunities(list);

      if (user) {
        const { data: mine } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id);
        const map = {};
        (mine || []).forEach(m => { map[m.community_id] = true; });
        setJoinedMap(map);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
    loadCommunities();
    loadTrending();
  }, [loadSuggestions, loadCommunities, loadTrending]);

  const searchAll = useCallback(async (q) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [profRes, commRes, tagRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, job_title')
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .neq('id', user?.id)
          .limit(20),
        supabase
          .from('communities')
          .select('*, community_members(count)')
          .ilike('name', `%${q}%`)
          .limit(10),
        supabase
          .from('hashtags')
          .select('name')
          .ilike('name', `%${q}%`)
          .limit(10),
      ]);

      const userIds = (profRes.data || []).map(p => p.id);
      const { data: follows } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user?.id)
        .in('following_id', userIds.length ? userIds : ['none']);

      const fMap = {};
      (follows || []).forEach(f => { fMap[f.following_id] = true; });
      setFollowMap(prev => ({ ...prev, ...fMap }));
      setUsers(profRes.data || []);
      setCommunityResults((commRes.data || []).map(c => ({ ...c, member_count: c.community_members?.[0]?.count || 0 })));
      setHashtagResults(tagRes.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (query.trim()) searchAll(query); }, 300);
    return () => clearTimeout(timer);
  }, [query, searchAll]);

  const loadTagPosts = useCallback(async (tag) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_hashtags')
        .select('posts(id, text, image_url, created_at, user_id), hashtags(name)')
        .eq('hashtags.name', tag)
        .limit(30);
      if (error) throw error;
      const posts = (data || [])
        .map(r => r.posts)
        .filter(Boolean)
        .filter(p => p.image_url)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setTagPosts(posts.map(p => ({
        id: p.id,
        text: p.text,
        postUserId: p.user_id,
        thumb: (() => { try { const u = JSON.parse(p.image_url); return u[0]; } catch { return p.image_url; } })(),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeFilter.startsWith('#')) {
      setTagPosts([]);
      loadTagPosts(activeFilter.slice(1));
    }
  }, [activeFilter, loadTagPosts]);

  const toggleFollow = async (targetId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (followMap[targetId]) {
        await supabase.from('followers').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowMap(prev => ({ ...prev, [targetId]: false }));
      } else {
        await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId });
        setFollowMap(prev => ({ ...prev, [targetId]: true }));
      }
    } catch {}
  };

  const toggleJoin = async (community) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (joinedMap[community.id]) {
        await supabase.from('community_members')
          .delete()
          .eq('community_id', community.id)
          .eq('user_id', user.id);
        setJoinedMap(prev => ({ ...prev, [community.id]: false }));
        setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c));
      } else {
        await supabase.from('community_members')
          .upsert({ community_id: community.id, user_id: user.id }, { onConflict: 'community_id,user_id' });
        setJoinedMap(prev => ({ ...prev, [community.id]: true }));
        setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, member_count: c.member_count + 1 } : c));
      }
    } catch {}
  };

  const featured = communities.find(c => c.is_featured) || communities[0] || null;
  const interests = communities.filter(c => !c.is_featured).slice(0, 3);

  const renderPersonCard = (item, size) => (
    <TouchableOpacity
      key={String(item.id)}
      style={[styles.personCard, { width: size }]}
      activeOpacity={0.8}
    >
      <View style={[styles.personAvatarWrap, { borderColor: colors.primaryContainer }]}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.personAvatar} />
        ) : (
          <View style={[styles.personAvatar, styles.personAvatarFallback]}>
            <MaterialIcons name="person" size={28} color={colors.onSurfaceVariant} />
          </View>
        )}
      </View>
      <Text style={styles.personName} numberOfLines={1}>{item.full_name || item.username}</Text>
      <Text style={styles.personTitle} numberOfLines={1}>
        {item.mutual > 0 ? `${item.mutual} mutual` : (item.job_title || '@' + (item.username || 'user'))}
      </Text>
      <TouchableOpacity
        style={[styles.followBtn, followMap[item.id] && { backgroundColor: colors.surfaceVariant, borderColor: colors.surfaceVariant }]}
        onPress={() => toggleFollow(item.id)}
      >
        <Text style={[styles.followBtnText, followMap[item.id] && { color: colors.onSurfaceVariant }]}>
          {followMap[item.id] ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFeatured = (community) => (
    <TouchableOpacity
      style={styles.featured}
      activeOpacity={0.9}
      onPress={() => community && onViewCommunity && onViewCommunity(community)}
    >
      {community?.image_url && (
        <Image source={{ uri: community.image_url }} style={styles.featuredBg} resizeMode="cover" />
      )}
      <View style={styles.featuredContent}>
        <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>Trending Now</Text>
        </View>
        <Text style={styles.featuredTitle}>{community?.name || 'Community'}</Text>
        <Text style={styles.featuredSub}>
          {community ? `${formatMembers(community.member_count)} · ${community.description || ''}` : ''}
        </Text>
        <TouchableOpacity
          style={[styles.joinBtn, { backgroundColor: joinedMap[community?.id] ? colors.surfaceVariant : colors.primary }]}
          activeOpacity={0.85}
          onPress={() => community && toggleJoin(community)}
        >
          <Text style={[styles.joinBtnText, { color: joinedMap[community?.id] ? colors.onSurfaceVariant : colors.onPrimaryContainer }]}>
            {joinedMap[community?.id] ? 'Joined ✓' : 'Join Community'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderInterest = (c) => {
    const tint = colors[c.color] || colors.primary;
    const joined = !!joinedMap[c.id];
    return (
      <TouchableOpacity
        key={String(c.id)}
        style={[styles.interestRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
        activeOpacity={0.7}
        onPress={() => onViewCommunity && onViewCommunity(c)}
      >
        <View style={[styles.interestIcon, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name={c.icon || 'groups'} size={24} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.interestTitle} numberOfLines={1}>{c.name}</Text>
          <Text style={styles.interestMembers}>{formatMembers(c.member_count)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinSmBtn, { borderColor: joined ? colors.surfaceVariant : colors.primary }, joined && { backgroundColor: colors.surfaceVariant }]}
          onPress={() => toggleJoin(c)}
        >
          <Text style={[styles.joinSmText, { color: joined ? colors.onSurfaceVariant : colors.primary }]}>
            {joined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
        <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    );
  };

  const renderInterests = () => (
    <>
      <Text style={styles.sectionTitle}>Explore Interests</Text>
      {interests.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No communities yet</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {interests.map(renderInterest)}
        </View>
      )}
    </>
  );

  const renderTagGrid = () => (
    <View style={styles.tagGrid}>
      {tagPosts.map(p => (
        <TouchableOpacity key={String(p.id)} onPress={() => onViewPost && onViewPost(p)} style={{ width: itemSize, marginBottom: 8 }}>
          <Image source={{ uri: p.thumb }} style={{ width: itemSize, height: itemSize, borderRadius: 12 }} resizeMode="cover" />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderResults = () => {
    if (loading) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
    }
    const noResults = users.length === 0 && communityResults.length === 0 && hashtagResults.length === 0;
    if (noResults) {
      return <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No results found</Text>;
    }
    return (
      <>
        {users.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>People</Text>
            {users.map(item => (
              <View key={String(item.id)} style={styles.userRow}>
                <View style={styles.userAvatar}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>{item.full_name || item.username}</Text>
                  {item.job_title ? <Text style={styles.userTitle} numberOfLines={1}>{item.job_title}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.followBtnSm, followMap[item.id] && { backgroundColor: colors.surfaceVariant, borderColor: colors.surfaceVariant }]}
                  onPress={() => toggleFollow(item.id)}
                >
                  <Text style={[styles.followBtnSmText, followMap[item.id] && { color: colors.onSurfaceVariant }]}>
                    {followMap[item.id] ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
        {communityResults.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Communities</Text>
            {communityResults.map(renderInterest)}
          </>
        )}
        {hashtagResults.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Hashtags</Text>
            {hashtagResults.map(h => (
              <TouchableOpacity
                key={h.name}
                style={[styles.userRow, { borderBottomWidth: 0 }]}
                onPress={() => setActiveFilter('#' + h.name)}
              >
                <View style={[styles.hashtagIcon, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[styles.hashtagIconText, { color: colors.primary }]}>#</Text>
                </View>
                <Text style={[styles.userName, { color: colors.primary }]}>#{h.name}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrap}>
          <Text style={styles.headline}>Discover Now</Text>

          <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="person-search" size={20} color={colors.outline} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search people, groups, or interests..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity onPress={() => { setQuery(''); setUsers([]); setCommunityResults([]); setHashtagResults([]); }}>
                <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.chipRow}>
            {FILTERS.map(f => {
              const active = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.primaryContainer }
                      : { backgroundColor: colors.surfaceVariant },
                  ]}
                  onPress={() => setActiveFilter(f.key)}
                >
                  <Text style={[styles.chipText, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!query.trim() && trending.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.sectionTitle, { fontSize: 15, marginBottom: 8 }]}>{t('trendingHashtags')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {trending.map(h => (
                  <TouchableOpacity
                    key={h.name}
                    style={[styles.trendingChip, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setActiveFilter('#' + h.name)}
                  >
                    <Text style={[styles.trendingChipText, { color: colors.primary }]}>#{h.name}</Text>
                    <Text style={[styles.trendingChipCount, { color: colors.onSurfaceVariant }]}>
                      {formatMembers(h.post_count)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {query.trim() ? (
            renderResults()
          ) : activeFilter === 'people' ? (
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.cardGrid}>
                {suggestions.slice(0, 6).map(item => renderPersonCard(item, cardSize))}
                {suggestions.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No people to suggest</Text>
                )}
              </View>
            )
          ) : activeFilter === 'communities' ? (
            <>
              {featured && renderFeatured(featured)}
              {renderInterests()}
            </>
          ) : activeFilter.startsWith('#') ? (
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : tagPosts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No posts for {activeFilter} yet</Text>
            ) : (
              renderTagGrid()
            )
          ) : (
            <>
              {featured && renderFeatured(featured)}
              <View style={styles.cardGrid}>
                {suggestions.slice(0, 2).map(item => renderPersonCard(item, cardSize))}
                {suggestions.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No people to suggest</Text>
                )}
              </View>
              {renderInterests()}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: {
      padding: 16,
      paddingTop: (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24) + 16,
      paddingBottom: 120,
    },
    contentWrap: { width: '100%', maxWidth: 600, alignSelf: 'center' },
    headline: { fontFamily: FONTS.headlineLg, fontSize: 24, lineHeight: 32, marginBottom: 16, color: colors.onSurface },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 4,
      borderRadius: 12,
      height: 52,
    },
    searchInput: { flex: 1, fontFamily: FONTS.bodyMd, fontSize: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
    chipText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    trendingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    trendingChipText: { fontFamily: FONTS.labelMd, fontSize: 13, fontWeight: '700' },
    trendingChipCount: { fontFamily: FONTS.labelMd, fontSize: 11 },
    featured: {
      borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainer,
      marginBottom: 16,
      minHeight: 200,
      justifyContent: 'flex-end',
    },
    featuredBg: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
    featuredContent: { padding: 16, gap: 4 },
    badge: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 8, marginBottom: 8,
    },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: FONTS.labelMd, textTransform: 'uppercase' },
    featuredTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, color: colors.onSurface },
    featuredSub: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 12 },
    joinBtn: {
      alignSelf: 'flex-start', paddingHorizontal: 24, paddingVertical: 8,
      borderRadius: 999,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    joinBtnText: { fontFamily: FONTS.labelMd, fontSize: 12, fontWeight: '700' },
    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
    personCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      borderWidth: 1, borderColor: colors.outlineVariant,
      padding: 16, alignItems: 'center',
    },
    personAvatarWrap: {
      width: 64, height: 64, borderRadius: 32,
      borderWidth: 2, padding: 2, marginBottom: 12,
    },
    personAvatar: { width: '100%', height: '100%', borderRadius: 28 },
    personAvatarFallback: {
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center', alignItems: 'center',
    },
    personName: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface },
    personTitle: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 12 },
    followBtn: {
      width: '100%', alignItems: 'center',
      paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: colors.primary,
    },
    followBtnText: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.primary, fontWeight: '600' },
    sectionTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, lineHeight: 28, color: colors.onSurface, marginBottom: 16 },
    interestRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, borderRadius: 16, borderWidth: 1,
    },
    interestIcon: {
      width: 48, height: 48, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    interestTitle: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface },
    interestMembers: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginTop: 2 },
    joinSmBtn: {
      paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
      borderWidth: 1,
    },
    joinSmText: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '600' },
    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center', marginTop: 24 },
    userRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '30',
    },
    userAvatar: {
      width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
      backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center',
    },
    userName: { fontFamily: FONTS.bodyLg, fontSize: 15, fontWeight: '600', color: colors.onSurface },
    userTitle: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
    followBtnSm: {
      paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: colors.primary,
    },
    followBtnSmText: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.primary, fontWeight: '600' },
    hashtagIcon: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    hashtagIconText: { fontFamily: FONTS.headlineMd, fontSize: 20 },
  });
}
