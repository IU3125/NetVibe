import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function VideoPlayer({ uri }) {
  const player = useVideoPlayer({ uri }, player => { player.loop = false; });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsPictureInPicture />;
}

function ZoomableImage({ uri }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const baseScale = useRef(1);
  const baseTx = useRef(0);
  const baseTy = useRef(0);
  const pinchDist = useRef(0);
  const isPinching = useRef(false);

  const getScale = () => scale.__getValue();

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => getScale() > 1,
    onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2 || getScale() > 1,
    onPanResponderGrant: (evt) => {
      baseScale.current = getScale();
      baseTx.current = translateX.__getValue();
      baseTy.current = translateY.__getValue();
      isPinching.current = evt.nativeEvent.touches.length === 2;
      if (isPinching.current) pinchDist.current = 0;
    },
    onPanResponderMove: (evt, gs) => {
      if (evt.nativeEvent.touches.length === 2) {
        isPinching.current = true;
        const [t1, t2] = evt.nativeEvent.touches;
        const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
        if (pinchDist.current === 0) { pinchDist.current = dist; return; }
        const s = Math.min(Math.max(baseScale.current * (dist / pinchDist.current), 0.5), 3);
        scale.setValue(s);
      } else if (getScale() > 1 && !isPinching.current) {
        const s = getScale();
        const max = (SCREEN_WIDTH * (s - 1)) / 2;
        translateX.setValue(Math.min(Math.max(baseTx.current + gs.dx, -max), max));
        translateY.setValue(Math.min(Math.max(baseTy.current + gs.dy, -max), max));
      }
    },
    onPanResponderRelease: () => {
      if (getScale() <= 1) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
        ]).start();
      }
    },
  })).current;

  return (
    <View {...panResponder.panHandlers} style={{ width: SCREEN_WIDTH, height: '100%', overflow: 'hidden' }}>
      <Animated.Image
        source={{ uri }}
        style={{
          width: '100%',
          height: '100%',
          transform: [{ scale }, { translateX }, { translateY }],
        }}
        resizeMode="cover"
      />
    </View>
  );
}

export default function PostDetailScreen({ post, onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [liked, setLiked] = useState(post?.liked || false);
  const [likeCount, setLikeCount] = useState(parseInt(String(post?.likes || '0').replace(/[^0-9]/g, '')) || 0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [authorProfile, setAuthorProfile] = useState(null);
  const [postData, setPostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [imagePage, setImagePage] = useState(0);
  const [saved, setSaved] = useState(false);

  const REPORT_REASONS = ['Spam', 'Harassment', 'Hate speech', 'Violence', 'Inappropriate content', 'Other'];

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !post?.id) return;
      supabase
        .from('saved_posts')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', post.id)
        .maybeSingle()
        .then(({ data }) => { if (mounted) setSaved(!!data); });
    });
    return () => { mounted = false; };
  }, [post?.id]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
      const targetId = post?.id;

      const profilePromise = post?.postUserId
        ? supabase.from('profiles').select('avatar_url, full_name, username').eq('id', post.postUserId).maybeSingle()
        : Promise.resolve({ data: null });

      const postPromise = targetId
        ? supabase.from('posts').select('*').eq('id', targetId).maybeSingle()
        : Promise.resolve({ data: null });

      const commentsPromise = targetId
        ? supabase.from('post_comments').select('id, text, created_at, user_id, parent_id').eq('post_id', targetId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] });

      const likesCountPromise = targetId
        ? supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', targetId)
        : Promise.resolve({ count: 0 });

      const myLikePromise = targetId && user
        ? supabase.from('post_likes').select('id').eq('post_id', targetId).eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null });

      const [profResult, postResult, commentsResult, likesCountResult, myLikeResult] = await Promise.all([
        profilePromise, postPromise, commentsPromise, likesCountPromise, myLikePromise,
      ]);

      const profile = profResult?.data || null;
      const pData = postResult?.data || null;
      const cData = commentsResult?.data || [];
      setAuthorProfile(profile);
      setPostData(pData);
      setLikeCount(likesCountResult?.count ?? 0);
      setLiked(!!myLikeResult?.data);

      let cmts = [];
      if (cData.length) {
        const userIds = [...new Set(cData.map(c => c.user_id))];
        const { data: cProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        const profMap = {};
        (cProfiles || []).forEach(p => { profMap[p.id] = p; });
        cmts = cData.map(c => ({
          id: c.id,
          username: profMap[c.user_id]?.full_name || profMap[c.user_id]?.username || 'User',
          text: c.text,
          time: timeAgo(c.created_at),
          likes: 0,
          liked: false,
          isReply: !!c.parent_id,
          avatar: profMap[c.user_id]?.avatar_url,
        }));
      }
      setComments(cmts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, user_id: user.id, text: commentText.trim() })
        .select()
        .single();
      if (error) throw error;
      setComments(prev => [{
        id: data.id,
        username: 'You',
        text: commentText.trim(),
        time: 'now',
        likes: 0,
        liked: false,
        isReply: false,
        avatar: null,
      }, ...prev]);
      setCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSendingComment(false);
    }
  };

  const toggleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (liked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        setLikeCount(prev => Math.max(0, prev - 1));
        setLiked(false);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
        setLikeCount(prev => prev + 1);
        setLiked(true);
      }
    } catch {}
  };

  const handleDeletePost = () => {
    Alert.alert(
      t('delete_post') || 'Delete Post',
      t('delete_post_confirm') || 'Are you sure you want to delete this post?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const urls = [];
              if (postData?.image_url) {
                try { urls.push(...JSON.parse(postData.image_url)); } catch { urls.push(postData.image_url); }
              }
              if (postData?.video_url) urls.push(postData.video_url);
              if (postData?.gif_url) urls.push(postData.gif_url);
              if (postData?.document_url) urls.push(postData.document_url);

              for (const url of urls) {
                const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl('');
                const path = url.split('/posts/')[1]?.split('?')[0];
                if (path) await supabase.storage.from('posts').remove([path]);
              }

              await supabase.from('post_comments').delete().eq('post_id', post.id);
              await supabase.from('post_likes').delete().eq('post_id', post.id);
              await supabase.from('posts').delete().eq('id', post.id);

              onBack();
            } catch {}
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const text = postData?.text || post?.text || '';
      const image = mediaUrl[0] || postData?.image_url || null;
      await Share.share({
        title: 'NetVibe',
        message: `${text}${image ? `\n\n${image}` : ''}\n\nShared via NetVibe`,
      });
    } catch {}
  };

  const toggleSaved = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !post?.id) return;
      if (saved) {
        await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', post.id);
        setSaved(false);
      } else {
        await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
        setSaved(true);
      }
    } catch {}
  };

  const handleReport = () => {
    Alert.alert(t('reportPost'), t('reportReasonTitle'), [
      ...REPORT_REASONS.map(r => ({ text: r, onPress: () => submitReport(r) })),
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const submitReport = async (reason) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !post?.id) return;
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        content_type: 'post',
        content_id: post.id,
        reason,
        description: (postData?.text || post?.text || '').slice(0, 200) || null,
      });
      if (error) throw error;
      Alert.alert(t('reportSubmittedTitle'), t('reportSubmitted'));
    } catch (err) {
      Alert.alert(t('error'), err.message);
    }
  };

  const mediaUrl = postData?.image_url
    ? (() => { try { return JSON.parse(postData.image_url); } catch { return [postData.image_url]; } })()
    : [];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.primary }]}>{t('post')}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          {currentUserId && (currentUserId === post?.postUserId || currentUserId === postData?.user_id) ? (
            <TouchableOpacity onPress={handleDeletePost}>
              <MaterialIcons name="delete-outline" size={22} color="#FF4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleReport}>
              <MaterialIcons name="report-gmailerrorred" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.authorRow, { paddingHorizontal: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.authorAvatar}>
              {authorProfile?.avatar_url ? (
                <Image source={{ uri: authorProfile.avatar_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
              )}
            </View>
            <View>
              <Text style={styles.authorName}>{authorProfile?.full_name || authorProfile?.username || post?.authorName || 'User'}</Text>
              <Text style={styles.authorTime}>{post?.time || timeAgo(postData?.created_at)}</Text>
            </View>
          </View>
        </View>

        {mediaUrl.length > 0 && (
          <View>
            <ScrollView
              horizontal paging
              showsHorizontalScrollIndicator={false}
              style={styles.imageContainer}
              onMomentumScrollEnd={e => {
                const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setImagePage(page);
              }}
            >
              {mediaUrl.map((url, i) => (
                <ZoomableImage key={i} uri={url} />
              ))}
            </ScrollView>
            {mediaUrl.length > 1 && (
              <View style={styles.dotsRow}>
                {mediaUrl.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, { backgroundColor: i === imagePage ? colors.primary : colors.onSurfaceVariant + '50' }]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
        {postData?.video_url && (
          <View style={[styles.imageContainer, { backgroundColor: '#000' }]}>
            <VideoPlayer uri={postData.video_url} />
          </View>
        )}
        {postData?.gif_url && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: postData.gif_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        )}
        {postData?.document_url && (
          <View style={[styles.docRow, { paddingHorizontal: 16, paddingTop: 16 }]}>
            <MaterialIcons name="description" size={24} color={colors.primary} />
            <Text style={[styles.docName, { color: colors.onSurface }]}>{postData.document_name || 'Document'}</Text>
          </View>
        )}
        {!mediaUrl.length && !postData?.video_url && !postData?.gif_url && !postData?.document_url && (
          <View style={styles.imageContainer}>
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="image" size={48} color={colors.onSurfaceVariant} />
            </View>
          </View>
        )}

        <View style={[styles.interactionBar, { paddingHorizontal: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity onPress={toggleLike} style={styles.interactionBtn}>
              <MaterialIcons
                name="favorite"
                size={22}
                color={liked ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={[styles.interactionText, liked && { color: colors.primary }]}>
                {likeCount > 0 ? likeCount : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.interactionBtn}>
              <MaterialIcons name="chat-bubble" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.interactionText}>{comments.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.interactionBtn} onPress={handleShare}>
              <MaterialIcons name="share" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={toggleSaved}>
            <MaterialIcons
              name={saved ? 'bookmark' : 'bookmark-border'}
              size={22}
              color={saved ? colors.primary : colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.contentSection, { paddingHorizontal: 16 }]}>
          <Text style={styles.contentText}>{postData?.text || post?.text || ''}</Text>
        </View>

        <View style={[styles.commentsSection, { paddingHorizontal: 16 }]}>
          <Text style={styles.commentsTitle}>{t('comments')}</Text>

          <View style={styles.commentInputRow}>
            <View style={[styles.commentAvatar, { backgroundColor: colors.surfaceContainer }]}>
              <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
            </View>
            <View style={[styles.commentInputWrap, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.surfaceContainerHigh }]}>
              <TextInput
                style={[styles.commentInput, { color: colors.onSurface }]}
                placeholder={t('writeComment')}
                placeholderTextColor={colors.onSurfaceVariant}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity onPress={handleSendComment} style={styles.sendBtn} disabled={sendingComment}>
                <MaterialIcons name="send" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {comments.map((c) => (
            <View key={c.id} style={[styles.commentRow, c.isReply && styles.commentReply]}>
              <View style={[styles.commentAvatar, c.isReply && styles.commentReplyAvatar, { backgroundColor: colors.surfaceContainer }]}>
                {c.avatar ? (
                  <Image source={{ uri: c.avatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <MaterialIcons name="person" size={c.isReply ? 14 : 18} color={colors.onSurfaceVariant} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.commentBubble, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={styles.commentUsername}>{c.username}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                <View style={styles.commentMeta}>
                  <Text style={styles.commentTime}>{c.time}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors, FONTS) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    backButton: { padding: 4 },
    moreButton: { padding: 4 },
    topTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, fontWeight: '600' },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    authorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    authorName: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface },
    authorTime: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
    followBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followBtnText: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.primary, fontWeight: '600' },
    imageContainer: { width: '100%', aspectRatio: 1 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    imagePlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoLabel: { fontFamily: FONTS.labelMd, fontSize: 12, marginTop: 8 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    docName: { fontFamily: FONTS.bodyMd, fontSize: 13 },
    interactionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    interactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    interactionText: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.onSurfaceVariant },
    contentSection: { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
    contentText: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurface, lineHeight: 22 },
    commentsSection: { paddingTop: 20 },
    commentsTitle: { fontFamily: FONTS.bodyLg, fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
    commentInputRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentInputWrap: {
      flex: 1,
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: 'flex-end',
    },
    commentInput: { flex: 1, fontFamily: FONTS.bodyMd, fontSize: 13, maxHeight: 80, paddingTop: 4 },
    sendBtn: { padding: 4, marginLeft: 4 },
    commentRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    commentReply: { marginLeft: 40 },
    commentReplyAvatar: { width: 28, height: 28, borderRadius: 14 },
    commentBubble: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    commentUsername: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
    commentText: { fontFamily: FONTS.bodyMd, fontSize: 13, color: colors.onSurface, lineHeight: 18 },
    commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, paddingHorizontal: 4 },
    commentTime: { fontFamily: FONTS.labelMd, fontSize: 10, color: colors.onSurfaceVariant },
  });
}
