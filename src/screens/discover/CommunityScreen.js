import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import CommunityChatScreen from './CommunityChatScreen';

const formatCount = (n) => {
  const count = Number(n || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
};

const resolveThumb = (url) => {
  if (!url) return null;
  try {
    const u = JSON.parse(url);
    if (Array.isArray(u)) return u[0];
    return url;
  } catch {
    return url;
  }
};

export default function CommunityScreen({ community, onBack, onViewPost }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(community?.member_count || 0);
  const [joined, setJoined] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [myId, setMyId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);

      const { data: countRow, count } = await supabase
        .from('community_members')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id);
      setMemberCount(count ?? memberCount);

      const { data: rows } = await supabase
        .from('community_members')
        .select('profiles(id, username, full_name, avatar_url)')
        .eq('community_id', community.id)
        .order('joined_at', { ascending: false });
      setMembers((rows || []).map(r => r.profiles).filter(Boolean));

      if (community.hashtag) {
        const { data: tagPosts, count: tagTotal } = await supabase
          .from('post_hashtags')
          .select('posts(id, text, image_url, created_at, user_id), hashtags(name)', { count: 'exact' })
          .eq('hashtags.name', community.hashtag)
          .limit(3);
        setPostCount(tagTotal ?? 0);
        setPosts((tagPosts || [])
          .map(r => r.posts)
          .filter(Boolean)
          .filter(p => resolveThumb(p.image_url))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map(p => ({ id: p.id, text: p.text, thumb: resolveThumb(p.image_url) })));
      }

      if (user) {
        const { data: mine } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('community_id', community.id)
          .eq('user_id', user.id);
        setJoined(!!mine?.length);
      } else {
        setJoined(false);
      }
    } catch {}
    setLoading(false);
  }, [community.id, community.hashtag]);

  useEffect(() => { load(); }, [load]);

  const toggleJoin = async () => {
    if (!myId || joining) return;
    setJoining(true);
    try {
      if (joined) {
        await supabase.from('community_members')
          .delete()
          .eq('community_id', community.id)
          .eq('user_id', myId);
        setJoined(false);
        setMemberCount(m => Math.max(0, m - 1));
      } else {
        await supabase.from('community_members')
          .upsert({ community_id: community.id, user_id: myId }, { onConflict: 'community_id,user_id' });
        setJoined(true);
        setMemberCount(m => m + 1);
      }
    } catch {}
    setJoining(false);
  };

  if (joined === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>Community</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (joined) {
    return <CommunityChatScreen community={community} onBack={onBack} />;
  }

  const tint = colors[community.color] || colors.primary;
  const locked = !joined;

  const renderMember = ({ item }) => (
    <View style={[styles.memberRow, { borderColor: colors.outlineVariant + '30' }]}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName} numberOfLines={1}>{item.full_name || 'User'}</Text>
        <Text style={styles.memberUser} numberOfLines={1}>@{item.username || item.id}</Text>
      </View>
    </View>
  );

  const renderPreviewTile = (post, idx) => {
    const wide = idx === 0;
    return (
      <TouchableOpacity
        key={String(post.id)}
        style={[styles.postTile, wide ? styles.postTileWide : styles.postTileSquare, { borderColor: colors.outlineVariant + '30' }]}
        activeOpacity={0.8}
        onPress={() => !locked && onViewPost && onViewPost({ id: post.id })}
      >
        <Image source={{ uri: post.thumb }} style={styles.postImg} resizeMode="cover" blurRadius={locked ? 8 : 0} />
        {locked && (
          <View style={styles.postLock}>
            <MaterialIcons name="lock" size={wide ? 34 : 20} color="#fff" />
            {wide && <Text style={styles.postLockText}>Join to view full post</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>Community</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMember}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              {community.image_url ? (
                <Image source={{ uri: community.image_url }} style={styles.heroBg} resizeMode="cover" />
              ) : (
                <View style={[styles.heroBg, { backgroundColor: colors.surfaceVariant }]} />
              )}
              <View style={styles.heroOverlay}>
                <View style={[styles.heroIconWrap, { backgroundColor: tint }]}>
                  <MaterialIcons name={community.icon || 'groups'} size={40} color="#fff" />
                </View>
                <Text style={styles.heroTitle}>{community.name}</Text>
                <Text style={styles.heroMeta}>{formatCount(memberCount)} members{community.hashtag ? ` · #${community.hashtag}` : ''}</Text>
                {!!community.description && (
                  <Text style={styles.heroDesc}>{community.description}</Text>
                )}
              </View>
            </View>

            {community.hashtag && (
              <View style={styles.tagRow}>
                <View style={[styles.tagChip, { backgroundColor: colors.surfaceContainer }]}>
                  <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]}>#{community.hashtag}</Text>
                </View>
              </View>
            )}

            {community.hashtag && (
              <View style={styles.previewSection}>
                <View style={styles.previewHead}>
                  <Text style={[styles.previewTitle, { color: colors.onSurface }]}>Recent Post Preview</Text>
                </View>
                {posts.length > 0 ? (
                  <View>
                    {renderPreviewTile(posts[0], 0)}
                    {posts.length > 1 && (
                      <View style={styles.postRow}>
                        {posts.slice(1, 3).map((p, i) => renderPreviewTile(p, i + 1))}
                      </View>
                    )}
                  </View>
                ) : loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                ) : (
                  <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No posts yet</Text>
                )}
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceContainer }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{formatCount(postCount)}</Text>
                <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Photos Shared</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceContainer }]}>
                <Text style={[styles.statValue, { color: colors.secondary }]}>{formatCount(memberCount)}</Text>
                <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Members</Text>
              </View>
            </View>

            <View style={[styles.section, { borderColor: colors.outlineVariant + '30' }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Members</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No members yet</Text>
          )
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.outlineVariant + '30' }]}>
        <TouchableOpacity style={[styles.shareBtn, { borderColor: colors.outlineVariant }]} activeOpacity={0.8}>
          <MaterialIcons name="share" size={20} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.joinBtn, { backgroundColor: joined ? colors.secondary : colors.primary }]}
          onPress={toggleJoin}
          disabled={!myId || joining}
          activeOpacity={0.85}
        >
          {joining ? (
            <ActivityIndicator color={joined ? colors.onSecondary : colors.onPrimary} size="small" />
          ) : (
            <>
              <MaterialIcons name={joined ? 'check-circle' : 'person-add'} size={20} color={joined ? colors.onSecondary : colors.onPrimary} />
              <Text style={[styles.joinBtnText, { color: joined ? colors.onSecondary : colors.onPrimary }]}>
                {joined ? 'Joined' : 'Join Community'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 8,
      paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24),
      height: 50 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: FONTS.labelLg, fontSize: 16 },
    hero: { overflow: 'hidden' },
    heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 230 },
    heroOverlay: {
      paddingTop: 40, paddingHorizontal: 20, paddingBottom: 24,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
    },
    heroIconWrap: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    heroTitle: { fontFamily: FONTS.labelXl, fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
    heroMeta: { fontFamily: FONTS.bodyMd, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    heroDesc: { fontFamily: FONTS.bodySm, fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 12, lineHeight: 19 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    tagText: { fontFamily: FONTS.labelMd, fontSize: 12 },
    previewSection: { paddingHorizontal: 16, paddingTop: 8 },
    previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    previewTitle: { fontFamily: FONTS.labelLg, fontSize: 17, fontWeight: '700' },
    postTile: { overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
    postTileWide: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
    postTileSquare: { flex: 1, aspectRatio: 1, borderRadius: 16 },
    postRow: { flexDirection: 'row', gap: 12 },
    postImg: { width: '100%', height: '100%' },
    postLock: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    postLockText: { fontFamily: FONTS.labelMd, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
    statCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
    statValue: { fontFamily: FONTS.labelXl, fontSize: 24, fontWeight: '700' },
    statLabel: { fontFamily: FONTS.labelMd, fontSize: 11, textTransform: 'uppercase', marginTop: 4 },
    section: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    sectionTitle: { fontFamily: FONTS.labelLg, fontSize: 16, fontWeight: '700' },
    listContent: { paddingBottom: 110 },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
    memberName: { fontFamily: FONTS.bodyMd, fontSize: 15, fontWeight: '600', color: colors.onSurface },
    memberUser: { fontFamily: FONTS.bodySm, fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center', marginTop: 40 },
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 30 : 14,
      borderTopWidth: 1,
    },
    shareBtn: {
      width: 48, height: 48, borderRadius: 14,
      borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    joinBtn: {
      flex: 1, height: 48, borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    joinBtnText: { fontFamily: FONTS.labelLg, fontSize: 15, fontWeight: '700' },
  });
}
