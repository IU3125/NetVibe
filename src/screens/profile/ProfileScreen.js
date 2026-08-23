import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getProfileCompletion } from '../../lib/profileCompletion';

const profileCache = {};

export function clearOwnProfileCache() {
  delete profileCache['__own__'];
}

const formatCount = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
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

export default function ProfileScreen({ onSignOut, onEditProfile, onSettings, onBack, profileId, onViewFollowers, onViewPost, onViewSaved }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('post');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [postsCount, setPostsCount] = useState(0);

  const isOwnProfile = !profileId;
  const cacheKey = profileId || '__own__';
  const completion = useMemo(() => getProfileCompletion(profile), [profile]);

  useEffect(() => {
    if (profileCache[cacheKey]) {
      const cached = profileCache[cacheKey];
      setProfile(cached.profile);
      setIsFollowing(cached.isFollowing);
      setIsMutual(cached.isMutual);
      setAccessDenied(cached.accessDenied);
      setFollowersCount(cached.followersCount || 0);
      setFollowingCount(cached.followingCount || 0);
      setPosts(cached.posts || []);
      setPostsCount(cached.postsCount || 0);
      setLoading(false);
    }
    loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetId = profileId || user.id;

      if (!isOwnProfile) {
        const { data: blockCheck } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', targetId)
          .eq('blocked_id', user.id)
          .maybeSingle();
        if (blockCheck) {
          setAccessDenied(true);
          setLoading(false);
          profileCache[cacheKey] = { profile: null, isFollowing: false, isMutual: false, accessDenied: true };
          return;
        }
      }

      const [profileResult, followersCountResult, followingCountResult, postsResult, likesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).maybeSingle(),
        supabase.from('followers').select('id', { count: 'exact', head: true }).eq('following_id', targetId),
        supabase.from('followers').select('id', { count: 'exact', head: true }).eq('follower_id', targetId),
        supabase.from('posts').select('id, text, image_url, video_url, gif_url, document_url, document_name, created_at, user_id').eq('user_id', targetId).order('created_at', { ascending: false }),
        supabase.from('post_likes').select('post_id, user_id'),
      ]);

      if (profileResult.error) throw profileResult.error;
      const profileData = profileResult.data;

      if (!isOwnProfile && !profileData) {
        setAccessDenied(true);
        setLoading(false);
        profileCache[cacheKey] = { profile: null, isFollowing: false, isMutual: false, accessDenied: true };
        return;
      }

      let following = false;
      let mutual = false;

      if (!isOwnProfile && profileData) {
        const followChecks = [
          supabase.from('followers').select('id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle(),
        ];
        if (profileData.visibility === 'friends') {
          followChecks.push(
            supabase.from('followers').select('id').eq('follower_id', targetId).eq('following_id', user.id).maybeSingle()
          );
        }
        const followResults = await Promise.all(followChecks);
        following = !!followResults[0]?.data;
        if (profileData.visibility === 'friends') {
          mutual = !!followResults[1]?.data;
          if (!following || !mutual) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
        }
      }

      setProfile(profileData);
      setFollowersCount(followersCountResult?.count ?? 0);
      setFollowingCount(followingCountResult?.count ?? 0);
      setIsFollowing(following);
      setIsMutual(mutual);

      const allLikes = likesResult?.data || [];
      const likeMap = {};
      allLikes.forEach(l => {
        if (!likeMap[l.post_id]) likeMap[l.post_id] = [];
        likeMap[l.post_id].push(l.user_id);
      });

      const mappedPosts = (postsResult?.data || []).map(post => {
        let thumb = null;
        let mediaType = null;
        if (post.image_url) {
          try {
            const urls = JSON.parse(post.image_url);
            if (urls.length) { thumb = urls[0]; mediaType = 'image'; }
          } catch { thumb = post.image_url; mediaType = 'image'; }
        } else if (post.video_url) { mediaType = 'video'; }
        else if (post.gif_url) { thumb = post.gif_url; mediaType = 'gif'; }
        else if (post.document_url) { mediaType = 'document'; }

        return {
          id: post.id,
          text: post.text || '',
          likes: formatCount(likeMap[post.id]?.length || 0),
          comments: '0',
          liked: (likeMap[post.id] || []).includes(user.id),
          authorName: profileData?.full_name || 'User',
          time: timeAgo(post.created_at),
          postUserId: post.user_id,
          thumb,
          mediaType,
        };
      });

      setPosts(mappedPosts);
      setPostsCount(mappedPosts.length);

      profileCache[cacheKey] = { profile: profileData, isFollowing: following, isMutual: mutual, accessDenied: false, followersCount: followersCountResult?.count ?? 0, followingCount: followingCountResult?.count ?? 0, posts: mappedPosts, postsCount: mappedPosts.length };
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profileId) return;
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileId);
        setIsFollowing(false);
        setIsMutual(false);
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: user.id, following_id: profileId });
        setIsFollowing(true);
        const { data: f2 } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', profileId)
          .eq('following_id', user.id)
          .maybeSingle();
        setIsMutual(!!f2);
      }
    } catch {}
  };

  const blockUser = async () => {
    if (!profileId) return;
    Alert.alert(t('confirm'), 'Block this user?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: profileId });
            if (isFollowing) {
              await supabase.from('followers').delete().eq('follower_id', user.id).eq('following_id', profileId);
            }
            setAccessDenied(true);
          } catch {}
        },
      },
    ]);
  };

  const downloadCv = async () => {
    if (!profile?.cv_url) return;
    try {
      const path = profile.cv_url.split('/public/cvs/')[1] || '';
      const { data: { signedUrl } } = await supabase.storage
        .from('cvs')
        .createSignedUrl(path, 60);

      if (signedUrl) {
        const fileName = decodeURIComponent(profile.cv_url.split('/').pop() || 'CV.pdf');
        const destination = new File(Paths.cache, fileName);
        const task = File.createDownloadTask(signedUrl, destination);
        const file = await task.downloadAsync();
        await Sharing.shareAsync(file.uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not download CV');
    }
  };

  if (accessDenied) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <MaterialIcons name="lock" size={48} color={colors.onSurfaceVariant} />
        <Text style={{ color: colors.onSurface, fontFamily: FONTS.bodyLg, fontSize: 16, marginTop: 16 }}>{t('profileNotFound')}</Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: FONTS.bodyMd, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>
          {t('profileNotAccessible')}
        </Text>
      </View>
    );
  }

  const p = profile || {};
  const socialLinks = p.social_links || [];
  const stats = [
    { label: t('post'), value: String(postsCount) },
    { label: t('followers'), value: formatCount(followersCount) },
    { label: t('following'), value: formatCount(followingCount) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topNav}>
        <View style={styles.topNavLeft}>
          {!isOwnProfile && (
            <TouchableOpacity onPress={onBack} style={styles.iconButton}>
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <View style={styles.coverContainer}>
          {p.cover_url ? (
            <Image source={{ uri: p.cover_url }} style={styles.coverImage} />
          ) : (
            <LinearGradient
              colors={[colors.primaryContainer, colors.background]}
              style={styles.coverGradient}
            />
          )}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={styles.coverOverlay}
          />
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarBorder}>
              {p.avatar_url ? (
                <Image source={{ uri: p.avatar_url }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={44} color={colors.onSurfaceVariant} />
                </View>
              )}
            </View>
            {p.is_employer ? (
              <View style={[styles.openToWorkBadge, { backgroundColor: colors.tertiary }]}>
                <MaterialIcons name="work" size={12} color="#FFFFFF" />
              </View>
            ) : p.open_to_work ? (
              <View style={styles.openToWorkBadge}>
                <MaterialIcons name="check" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          {p.is_employer ? (
            <View style={[styles.openToWorkRow, { backgroundColor: colors.tertiary + '22' }]}>
              <MaterialIcons name="work" size={14} color={colors.tertiary} />
              <Text style={[styles.openToWorkText, { color: colors.tertiary }]}>{t('employer')}</Text>
            </View>
          ) : p.open_to_work ? (
            <View style={styles.openToWorkRow}>
              <MaterialIcons name="work" size={14} color={colors.secondary} />
              <Text style={styles.openToWorkText}>{t('openToWork')}</Text>
            </View>
          ) : null}

          <Text style={styles.name}>{p.full_name || t('noName')}</Text>
          <Text style={styles.username}>@{p.username || 'username'}</Text>
          {p.job_title && (
            <Text style={styles.title}>{p.job_title}</Text>
          )}

          <View style={styles.actionRow}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity style={styles.editButton} activeOpacity={0.85} onPress={onEditProfile}>
                  <Text style={styles.editButtonText}>{t('editProfile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsButton} activeOpacity={0.85} onPress={onViewSaved}>
                  <MaterialIcons name="bookmark" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsButton} activeOpacity={0.85} onPress={onSettings}>
                  <MaterialIcons name="settings" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.editButton, isFollowing && { backgroundColor: colors.surfaceContainerHigh }]}
                  activeOpacity={0.85}
                  onPress={toggleFollow}
                >
                  <Text style={[styles.editButtonText, isFollowing && { color: colors.onSurface }]}>
                    {isFollowing ? t('followingLabel') : t('follow')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsButton} activeOpacity={0.85} onPress={blockUser}>
                  <MaterialIcons name="block" size={20} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((stat, index) => {
            const isFollowerStat = stat.label === t('followers');
            const isFollowingStat = stat.label === t('following');
            const isPressable = isFollowerStat || isFollowingStat;
            const content = (
              <View style={[styles.statItem, index > 0 && styles.statBorder]}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
            if (isPressable) {
              return (
                <TouchableOpacity
                  key={stat.label}
                  style={{ flex: 1 }}
                  onPress={() => onViewFollowers && onViewFollowers(isFollowerStat ? 'followers' : 'following')}
                >
                  {content}
                </TouchableOpacity>
              );
            }
            return <View key={stat.label} style={{ flex: 1 }}>{content}</View>;
          })}
        </View>

        {/* Profile Completion (own profile only) */}
        {isOwnProfile && completion.percent < 100 && (
          <TouchableOpacity
            style={styles.completionCard}
            activeOpacity={0.85}
            onPress={onEditProfile}
          >
            <View style={styles.completionTop}>
              <Text style={styles.completionTitle}>{t('profileCompletion')}</Text>
              <Text style={styles.completionPercent}>{completion.percent}%</Text>
            </View>
            <View style={styles.completionBarBg}>
              <View
                style={[styles.completionBarFill, { width: `${completion.percent}%` }]}
              />
            </View>
            <Text style={styles.completionCta}>{t('completeNow')} →</Text>
          </TouchableOpacity>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'post' && styles.tabActive]}
            onPress={() => setActiveTab('post')}
          >
            <Text style={[styles.tabText, activeTab === 'post' && styles.tabTextActive]}>
              {t('post')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.tabActive]}
            onPress={() => setActiveTab('details')}
          >
            <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
              {t('details')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'post' && (
          <View style={styles.postsContainer}>
            {posts.length === 0 && (
              <Text style={[styles.noPostsText, { color: colors.onSurfaceVariant }]}>{t('noPosts')}</Text>
            )}
            {posts.map((post) => (
              <TouchableOpacity key={post.id} style={styles.postCard} onPress={() => onViewPost && onViewPost(post)}>
                <View style={styles.postHeader}>
                  <View style={styles.postAvatarWrap}>
                    {p.avatar_url ? (
                      <Image source={{ uri: p.avatar_url }} style={styles.postAvatar} />
                    ) : (
                      <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.postName}>{p.full_name || 'User'}</Text>
                    <Text style={styles.postTime}>{post.time}</Text>
                  </View>
                </View>
                <Text style={styles.postText}>{post.text}</Text>
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
                  <View style={styles.postActionsLeft}>
                    <TouchableOpacity style={styles.postActionBtn}>
                      <MaterialIcons
                        name="favorite"
                        size={18}
                        color={post.liked ? colors.primary : colors.onSurfaceVariant}
                      />
                      <Text style={[styles.postActionText, post.liked && { color: colors.primary }]}>
                        {post.likes}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postActionBtn}>
                      <MaterialIcons name="chat-bubble" size={18} color={colors.onSurfaceVariant} />
                      <Text style={styles.postActionText}>{post.comments}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity>
                    <MaterialIcons name="share" size={18} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'details' && (
          <View style={styles.sections}>
            {/* About */}
            {p.bio ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="person" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>{t('about')}</Text>
                </View>
                <Text style={styles.cardBody}>{p.bio}</Text>
              </View>
            ) : null}

            {/* Info */}
            {p.location || socialLinks.length > 0 || p.job_title ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="info" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>{t('information')}</Text>
                </View>
                <View style={styles.infoList}>
                  {p.location ? (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="location-on" size={18} color={colors.primary} />
                      <Text style={styles.infoText}>{p.location}</Text>
                    </View>
                  ) : null}
                  {p.job_title && p.company ? (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="work" size={18} color={colors.primary} />
                      <Text style={styles.infoText}>{p.job_title} at {p.company}</Text>
                    </View>
                  ) : p.job_title ? (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="work" size={18} color={colors.primary} />
                      <Text style={styles.infoText}>{p.job_title}</Text>
                    </View>
                  ) : null}
                  {socialLinks.map((link, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.infoRow}
                      onPress={() => Linking.openURL(link.startsWith('http') ? link : `https://${link}`)}
                    >
                      <MaterialIcons name="link" size={18} color={colors.primary} />
                      <Text style={[styles.infoText, styles.infoLink]}>{link}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* CV */}
            {p.cv_url ? (
              <TouchableOpacity style={styles.cvCard} onPress={downloadCv}>
                <MaterialIcons name="description" size={24} color={colors.primary} />
                <View style={styles.cvInfo}>
                  <Text style={styles.cvTitle}>{t('cvResume')}</Text>
                  <Text style={styles.cvHint}>{t('tapToDownload')}</Text>
                </View>
                <MaterialIcons name="file-download" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStyles(colors, FONTS) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    backgroundColor: 'rgba(19,19,19,0.8)',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverContainer: {
    height: 200,
    width: '100%',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: -56,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarBorder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: colors.background,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openToWorkBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  openToWorkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74,225,131,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  openToWorkText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
  },
  name: {
    fontFamily: FONTS.headlineLg,
    fontSize: 22,
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  username: {
    fontFamily: FONTS.bodyMd,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  title: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
    maxWidth: 320,
  },
  editButton: {
    flex: 1,
    height: 44,
    backgroundColor: colors.primaryContainer,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 24,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(65,71,83,0.3)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(65,71,83,0.3)',
  },
  statValue: {
    fontFamily: FONTS.headlineMd,
    fontSize: 20,
    color: colors.onSurface,
    fontWeight: '600',
  },
  statLabel: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
  },
  completionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  completionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTitle: {
    fontFamily: FONTS.labelMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  completionPercent: {
    fontFamily: FONTS.labelMd,
    fontSize: 13,
    color: colors.primary,
  },
  completionBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  completionCta: {
    fontFamily: FONTS.labelMd,
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: FONTS.labelMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.primary,
  },
  sections: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: FONTS.headlineMd,
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '600',
  },
  cardBody: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurface,
    flex: 1,
  },
  infoLink: {
    color: colors.primary,
  },
  cvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  cvInfo: {
    flex: 1,
  },
  cvTitle: {
    fontFamily: FONTS.headlineMd,
    fontSize: 14,
    color: colors.onSurface,
    fontWeight: '600',
  },
  cvHint: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  postsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  noPostsText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  postCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(65,71,83,0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  postAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatar: {
    width: '100%',
    height: '100%',
  },
  postName: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: '700',
  },
  postTime: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  postText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 20,
    marginBottom: 10,
  },
  postMedia: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
  },
  postMediaPlaceholder: {
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postActionsLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  postActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postActionText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  });
}
