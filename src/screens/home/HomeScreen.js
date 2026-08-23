import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { cacheGet, cacheSet } from '../../lib/cache';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';
import StoryPreview from '../../components/StoryPreview';

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd';
  return new Date(date).toLocaleDateString();
};

const formatCount = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
};

export default function HomeScreen({ onViewPost, onViewStory, onAddStory }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    const cached = await cacheGet('feed');
    if (cached && Array.isArray(cached.data) && cached.data.length) {
      setPosts(cached.data);
      setLoading(false);
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: follows } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      const followedIds = (follows || []).map(f => f.following_id);
      followedIds.push(user.id);

      const { data: followedPosts } = await supabase
        .from('posts')
        .select('id, text, image_url, video_url, gif_url, document_url, document_name, created_at, user_id, visibility')
        .in('user_id', followedIds)
        .in('visibility', ['public', 'friends'])
        .order('created_at', { ascending: false })
        .limit(20);

      let otherPosts = [];
      if (followedIds.length > 1) {
        const { data: extra } = await supabase
          .from('posts')
          .select('id, text, image_url, video_url, gif_url, document_url, document_name, created_at, user_id, visibility')
          .not('user_id', 'in', followedIds)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(5);
        otherPosts = extra || [];
      }

      const allPosts = [...(followedPosts || []), ...otherPosts];
      const userIds = [...new Set(allPosts.map(p => p.user_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });

      const postIds = allPosts.map(p => p.id);

      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      const likeMap = {};
      (likes || []).forEach(l => {
        if (!likeMap[l.post_id]) likeMap[l.post_id] = [];
        likeMap[l.post_id].push(l.user_id);
      });

      const mapped = allPosts.map(post => {
        let thumb = null;
        let mediaType = null;
        if (post.image_url) {
          try { const urls = JSON.parse(post.image_url); if (urls.length) { thumb = urls[0]; mediaType = 'image'; } }
          catch { thumb = post.image_url; mediaType = 'image'; }
        } else if (post.video_url) { mediaType = 'video'; }
        else if (post.gif_url) { thumb = post.gif_url; mediaType = 'gif'; }
        else if (post.document_url) { mediaType = 'document'; }

        return {
          id: post.id,
          text: post.text || '',
          likes: formatCount(likeMap[post.id]?.length || 0),
          liked: (likeMap[post.id] || []).includes(user.id),
          time: timeAgo(post.created_at),
          postUserId: post.user_id,
          authorName: profMap[post.user_id]?.full_name || profMap[post.user_id]?.username || 'User',
          authorAvatar: profMap[post.user_id]?.avatar_url,
          thumb,
          mediaType,
        };
      });

      setPosts(mapped);
      cacheSet('feed', mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const renderPost = ({ item: post }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => onViewPost && onViewPost(post)} activeOpacity={0.9}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatarWrap}>
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.postAvatar} />
          ) : (
            <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postName}>{post.authorName}</Text>
          <Text style={styles.postTime}>{post.time}</Text>
        </View>
      </View>
      <Text style={styles.postText} numberOfLines={4}>{post.text}</Text>
      {post.mediaType === 'image' && post.thumb && (
        <Image source={{ uri: post.thumb }} style={styles.postMedia} resizeMode="cover" />
      )}
      {post.mediaType === 'gif' && post.thumb && (
        <Image source={{ uri: post.thumb }} style={styles.postMedia} resizeMode="cover" />
      )}
      {post.mediaType === 'video' && (
        <View style={[styles.postMedia, styles.postMediaPlaceholder]}>
          <MaterialIcons name="play-circle" size={32} color={colors.onSurfaceVariant} />
        </View>
      )}
      {post.mediaType === 'document' && (
        <View style={[styles.postMedia, styles.postMediaPlaceholder]}>
          <MaterialIcons name="description" size={24} color={colors.onSurfaceVariant} />
        </View>
      )}
      <View style={styles.postActions}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="favorite" size={18} color={post.liked ? colors.primary : colors.onSurfaceVariant} />
            <Text style={[styles.actionText, post.liked && { color: colors.primary }]}>{post.likes}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="chat-bubble" size={18} color={colors.onSurfaceVariant} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={item => String(item.id)}
        renderItem={renderPost}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<StoryPreview onViewStory={onViewStory} onAddStory={onAddStory} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <MaterialIcons name="rss-feed" size={48} color={colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{t('homeFeed')}</Text>
          </View>
        }
      />
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 60 },
    list: { padding: 16, gap: 16, paddingBottom: 40 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center' },
    postCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(65,71,83,0.1)',
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    postAvatarWrap: {
      width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
      backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center',
    },
    postAvatar: { width: '100%', height: '100%' },
    postName: { fontFamily: FONTS.bodyMd, fontSize: 13, color: colors.onSurface, fontWeight: '700' },
    postTime: { fontSize: 11, color: colors.onSurfaceVariant },
    postText: { fontFamily: FONTS.bodyMd, fontSize: 13, color: colors.onSurface, lineHeight: 20, marginBottom: 10 },
    postMedia: { width: '100%', height: 160, borderRadius: 8, marginBottom: 10 },
    postMediaPlaceholder: { backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center' },
    postActions: { flexDirection: 'row', alignItems: 'center' },
    actionText: { fontSize: 11, color: colors.onSurfaceVariant },
  });
}
