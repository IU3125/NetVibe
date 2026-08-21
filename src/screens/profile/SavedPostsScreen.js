import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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

const timeAgo = (date) => {
  if (!date) return '';
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

const getThumb = (imageUrl) => {
  if (!imageUrl) return null;
  try { const arr = JSON.parse(imageUrl); return arr[0] || null; } catch { return imageUrl; }
};

export default function SavedPostsScreen({ onBack, onViewPost }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: rows, error } = await supabase
        .from('saved_posts')
        .select('created_at, posts(id, text, image_url, video_url, created_at, user_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const list = (rows || [])
        .filter(r => r.posts)
        .map(r => ({
          savedAt: r.created_at,
          ...r.posts,
          postUserId: r.posts.user_id,
          thumb: getThumb(r.posts.image_url),
        }));

      const authorIds = [...new Set(list.map(p => p.postUserId))];
      let authorMap = {};
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', authorIds);
        (profiles || []).forEach(p => { authorMap[p.id] = p; });
      }
      authorMap = { ...authorMap };

      setItems(list.map(p => ({
        ...p,
        authorName: authorMap[p.postUserId]?.full_name || authorMap[p.postUserId]?.username || 'User',
        authorAvatar: authorMap[p.postUserId]?.avatar_url || null,
      })));
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={() => onViewPost && onViewPost({
        id: item.id,
        text: item.text,
        postUserId: item.postUserId,
        image_url: item.image_url,
        video_url: item.video_url,
        time: timeAgo(item.created_at),
        likes: 0,
      })}
    >
      {item.thumb ? (
        <Image source={{ uri: item.thumb }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="article" size={22} color={colors.onSurfaceVariant} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.authorAvatar ? (
            <Image source={{ uri: item.authorAvatar }} style={styles.miniAvatar} />
          ) : (
            <View style={[styles.miniAvatar, { backgroundColor: colors.surfaceContainer }]}>
              <MaterialIcons name="person" size={12} color={colors.onSurfaceVariant} />
            </View>
          )}
          <Text style={styles.authorName} numberOfLines={1}>{item.authorName}</Text>
        </View>
        {item.text ? (
          <Text style={styles.itemText} numberOfLines={2}>{item.text}</Text>
        ) : (
          <Text style={styles.itemTextNoContent}>[{t('post')}]</Text>
        )}
        <Text style={styles.itemTime}>{timeAgo(item.savedAt)}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.primary }]}>{t('savedPosts')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
              <MaterialIcons name="bookmark-border" size={40} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: FONTS.bodyMd, fontSize: 14 }}>
                {t('noSavedPosts')}
              </Text>
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
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant + '20',
    },
    thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surfaceContainerLow },
    thumbFallback: { justifyContent: 'center', alignItems: 'center' },
    miniAvatar: { width: 18, height: 18, borderRadius: 9, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    authorName: { fontFamily: FONTS.labelMd, fontSize: 12, color: colors.onSurfaceVariant },
    itemText: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurface, marginTop: 3 },
    itemTextNoContent: { fontFamily: FONTS.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, marginTop: 3 },
    itemTime: { fontFamily: FONTS.labelMd, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 3 },
  });
}
