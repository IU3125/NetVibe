import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

const AVATAR_SIZE = 58;
const RING_SIZE = 64;

export default function StoryPreview({ onViewStory, onAddStory }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [stories, setStories] = useState([]);
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('avatar_url, full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      setMyProfile(prof);

      const { data: follows } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      const followedIds = (follows || []).map(f => f.following_id);
      followedIds.push(user.id);

      const { data: storyData } = await supabase
        .from('stories')
        .select('id, user_id, media_url, type, created_at')
        .in('user_id', followedIds)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!storyData?.length) { setStories([]); return; }

      const userIds = [...new Set(storyData.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });

      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', user.id)
        .in('story_id', storyData.map(s => s.id));

      const viewedIds = new Set((views || []).map(v => v.story_id));

      const userStories = {};
      storyData.forEach(s => {
        if (!userStories[s.user_id]) {
          userStories[s.user_id] = {
            userId: s.user_id,
            name: profMap[s.user_id]?.full_name || profMap[s.user_id]?.username || 'User',
            avatar: profMap[s.user_id]?.avatar_url,
            stories: [],
            allViewed: true,
          };
        }
        userStories[s.user_id].stories.push({ id: s.id, media_url: s.media_url, type: s.type });
        if (!viewedIds.has(s.id)) userStories[s.user_id].allViewed = false;
      });

      setStories(Object.values(userStories));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.item} onPress={onAddStory}>
          <View style={styles.addRing}>
            <View style={styles.avatarWrap}>
              {myProfile?.avatar_url ? (
                <Image source={{ uri: myProfile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
                </View>
              )}
            </View>
            <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="add" size={16} color="#FFF" />
            </View>
          </View>
          <Text style={styles.name}>Your Story</Text>
        </TouchableOpacity>
        {stories.map((item) => (
          <TouchableOpacity key={item.userId} style={styles.item} onPress={() => onViewStory && onViewStory(item)}>
            <View style={[styles.ring, !item.allViewed && { borderColor: colors.primary }]}>
              <View style={styles.avatarWrap}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Text style={[styles.avatarLetter, { color: colors.onSurfaceVariant }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { paddingVertical: 8 },
    scroll: { paddingHorizontal: 16, gap: 14 },
    item: { alignItems: 'center', gap: 4, width: 68 },
    ring: {
      width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
      borderWidth: 2, borderColor: colors.outlineVariant,
      justifyContent: 'center', alignItems: 'center',
    },
    addRing: {
      width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
      borderWidth: 2, borderColor: colors.outlineVariant,
      justifyContent: 'center', alignItems: 'center', position: 'relative',
    },
    avatarWrap: {
      width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
    },
    avatar: { width: '100%', height: '100%' },
    avatarFallback: {
      width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    },
    avatarLetter: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 18 },
    addBadge: {
      position: 'absolute', bottom: -2, right: -2,
      width: 22, height: 22, borderRadius: 11,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    name: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  });
}
