import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Platform, FlatList, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DURATION = 5000;
const INTERVAL = 50;

function ZoomableImage({ uri }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}

function VideoStory({ uri }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <MaterialIcons name="play-circle" size={64} color="rgba(255,255,255,0.7)" style={styles.playIcon} />
    </View>
  );
}

export default function StoryViewer({ userStory, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [stories, setStories] = useState(userStory?.stories || []);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const timerRef = useRef(null);
  const story = stories[currentIndex];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id));
    if (userStory?.userId) {
      supabase.from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', userStory.userId)
        .maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, []);

  useEffect(() => {
    if (story) markViewed();
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [currentIndex]);

  const markViewed = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !story || user.id === story.user_id) return;
    await supabase.from('story_views').upsert(
      { user_id: user.id, story_id: story.id },
      { onConflict: 'user_id, story_id' }
    );
  };

  const startTimer = () => {
    setProgress(0);
    clearInterval(timerRef.current);
    if (story?.type === 'video' || paused) return;
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + INTERVAL;
        if (next >= DURATION) {
          clearInterval(timerRef.current);
          goNext();
          return 0;
        }
        return next;
      });
    }, INTERVAL);
  };

  useEffect(() => {
    if (paused) {
      clearInterval(timerRef.current);
    } else if (story?.type !== 'video') {
      startTimer();
    }
  }, [paused]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      onClose();
    }
  };

  const handleTap = (evt) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.3) goPrev();
    else if (x > SCREEN_WIDTH * 0.7) goNext();
  };

  const togglePause = () => setPaused(p => !p);

  const handleDeleteStory = async () => {
    await supabase.from('stories').delete().eq('id', story.id);
    const remaining = stories.filter(s => s.id !== story.id);
    setStories(remaining);
    if (remaining.length === 0) onClose();
  };

  const loadViewers = async () => {
    const { data: views } = await supabase
      .from('story_views')
      .select('user_id, created_at')
      .eq('story_id', story.id)
      .order('created_at', { ascending: false });
    if (!views?.length) { setViewers([]); setShowViewers(true); return; }
    const userIds = views.map(v => v.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds);
    const profMap = {};
    (profiles || []).forEach(p => { profMap[p.id] = p; });
    setViewers(
      views.map(v => ({
        id: v.user_id,
        name: profMap[v.user_id]?.full_name || profMap[v.user_id]?.username || 'User',
        avatar: profMap[v.user_id]?.avatar_url,
        time: v.created_at,
      }))
    );
    setShowViewers(true);
  };

  if (!story) return null;

  const isOwner = currentUserId === userStory?.userId;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.touchArea}>
        {story.type === 'video' ? <VideoStory uri={story.media_url} /> : <ZoomableImage uri={story.media_url} />}

        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View key={i} style={[styles.progressBg, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: '#FFF',
                    width: i < currentIndex ? '100%' : i === currentIndex ? `${(progress / DURATION) * 100}%` : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={styles.viewerAvatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <MaterialIcons name="person" size={18} color="#FFF" />
              )}
            </View>
            <Text style={styles.viewerName}>{profile?.full_name || profile?.username || 'User'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isOwner && (
              <>
                <TouchableOpacity onPress={loadViewers}>
                  <MaterialIcons name="visibility" size={24} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteStory}>
                  <MaterialIcons name="delete-outline" size={24} color="#FFF" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {paused && (
          <View style={styles.pauseIndicator}>
            <MaterialIcons name="pause" size={48} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.pauseBtn} onPress={togglePause}>
        <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={20} color="#FFF" />
      </TouchableOpacity>

      {isOwner && (
        <TouchableOpacity style={styles.viewersBtn} onPress={loadViewers}>
          <MaterialIcons name="visibility" size={16} color="#FFF" />
          <Text style={styles.viewersBtnText}>Views</Text>
        </TouchableOpacity>
      )}

      {/* Viewers Modal */}
      <Modal visible={showViewers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#1c1b1b' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Story Views</Text>
              <TouchableOpacity onPress={() => setShowViewers(false)}>
                <MaterialIcons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            {viewers.length === 0 ? (
              <Text style={styles.noViewers}>No views yet</Text>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <View style={styles.viewerItemAvatar}>
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <MaterialIcons name="person" size={18} color="#FFF" />
                      )}
                    </View>
                    <Text style={styles.viewerItemName}>{item.name}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  touchArea: { flex: 1, width: '100%', height: '100%' },
  pauseIndicator: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -24, marginTop: -24, zIndex: 20,
  },
  pauseBtn: {
    position: 'absolute', bottom: 100, right: 20, zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -32, marginTop: -32,
  },
  progressRow: {
    flexDirection: 'row', gap: 4, paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 10,
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  progressBg: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 8,
    position: 'absolute', top: 20, left: 0, right: 0, zIndex: 10,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerAvatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  viewerName: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, color: '#FFF' },
  viewersBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20,
  },
  viewersBtnText: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, color: '#FFF' },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 16, color: '#FFF' },
  noViewers: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: 30 },
  viewerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  viewerItemAvatar: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  viewerItemName: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 14, color: '#FFF', flex: 1 },
});
