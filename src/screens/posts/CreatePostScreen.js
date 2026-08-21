import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';

const BG_COLORS = [
  '#131313', '#1a1a2e', '#16213e', '#0f3460', '#1e3a5f',
  '#1b4332', '#2d6a4f', '#40916c', '#52b788', '#5c4d33',
  '#6b3a2a', '#8b4513', '#a0522d', '#4a1942', '#2c1320',
  '#7b2d8e', '#9b59b6', '#c0392b', '#e74c3c', '#d35400',
  '#e67e22', '#f39c12', '#2c3e50', '#34495e', '#1e1e2f',
  '#2d2d2d', '#3d3d3d', '#283618', '#606c38', '#006d77',
];

const VISIBILITY_OPTIONS = [
  { key: 'public', icon: 'public' },
  { key: 'friends', icon: 'people' },
];

const GIPHY_API_KEY = '44W4JQTS2FtekFxBOKxK7Ronr3lyeKVM';

export default function CreatePostScreen({ onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [showVisibility, setShowVisibility] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [profile, setProfile] = useState(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -30) {
          expandSheet();
        } else if (gs.dy > 30) {
          collapseSheet();
        } else {
          snapSheet();
        }
        Animated.spring(panY, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
      },
    })
  ).current;

  const expandSheet = () => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: false, friction: 8 }).start();
    setSheetExpanded(true);
  };

  const collapseSheet = () => {
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
    setSheetExpanded(false);
  };

  const snapSheet = () => {
    Animated.spring(sheetAnim, {
      toValue: sheetExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setProfile(data);
    });
  }, []);

  const toggleSheet = () => {
    if (sheetExpanded) {
      collapseSheet();
    } else {
      expandSheet();
    }
  };

  const countByType = (type) => mediaItems.filter(m => m.type === type).length;

  const addMedia = (type, data) => {
    if (mediaItems.length >= 3) {
      Alert.alert('Limit', `Maximum 3 items allowed (${mediaItems.length}/3)`);
      return false;
    }
    if (type === 'image' && countByType('image') >= 2) {
      Alert.alert('Limit', 'Maximum 2 images allowed');
      return false;
    }
    if (type === 'video' && countByType('video') >= 1) {
      Alert.alert('Limit', 'Maximum 1 video allowed');
      return false;
    }
    if (type === 'gif' && countByType('gif') >= 1) {
      Alert.alert('Limit', 'Maximum 1 GIF allowed');
      return false;
    }
    if (type === 'document' && countByType('document') >= 1) {
      Alert.alert('Limit', 'Maximum 1 document allowed');
      return false;
    }
    setMediaItems(prev => [...prev, { type, data, id: Date.now().toString() + Math.random() }]);
    return true;
  };

  const removeMedia = (id) => {
    setMediaItems(prev => prev.filter(m => m.id !== id));
  };

  const moveMedia = (id, direction) => {
    setMediaItems(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const pickImage = async () => {
    if (mediaItems.length >= 3) {
      Alert.alert('Limit', 'Maximum 3 media items allowed');
      return;
    }
    if (countByType('image') >= 2) {
      Alert.alert('Limit', 'Maximum 2 images allowed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      addMedia('image', result.assets[0]);
    }
  };

  const pickVideo = async () => {
    if (mediaItems.length >= 3) {
      Alert.alert('Limit', 'Maximum 3 media items allowed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset.duration && asset.duration > 30000) {
        Alert.alert('Video too long', 'Maximum video duration is 30 seconds');
        return;
      }
      addMedia('video', asset);
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('error'), 'Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset.type?.startsWith('video')) {
        if (asset.duration && asset.duration > 30000) {
          Alert.alert('Video too long', 'Maximum video duration is 30 seconds');
          return;
        }
        addMedia('video', asset);
      } else {
        addMedia('image', asset);
      }
    }
  };

  const pickDocument = async () => {
    if (mediaItems.length >= 3) {
      Alert.alert('Limit', 'Maximum 3 media items allowed');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      addMedia('document', result.assets[0]);
    }
  };

  const searchGifs = async (query) => {
    setGifLoading(true);
    try {
      const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30`;
      const res = await fetch(url);
      const data = await res.json();
      setGifResults(data.data || []);
    } catch {
      Alert.alert(t('error'), 'Failed to load GIFs');
    } finally {
      setGifLoading(false);
    }
  };

  useEffect(() => {
    if (showGifPicker) {
      searchGifs(gifSearch);
    }
  }, [showGifPicker]);

  useEffect(() => {
    if (showGifPicker) {
      const timer = setTimeout(() => searchGifs(gifSearch), 400);
      return () => clearTimeout(timer);
    }
  }, [gifSearch]);

  const selectGif = (gif) => {
    if (mediaItems.length >= 3) {
      Alert.alert('Limit', 'Maximum 3 media items allowed');
      return;
    }
    const url = gif.images?.downsized?.url || gif.images?.original?.url;
    if (url) {
      addMedia('gif', { uri: url, id: gif.id });
    }
    setShowGifPicker(false);
  };

  const handlePost = async () => {
    if (!text.trim() && mediaItems.length === 0) {
      Alert.alert(t('error'), t('postEmpty'));
      return;
    }
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert(t('error'), t('notAuthenticated')); return; }

      let imageUrls = [];
      let videoUrl = null;
      let gifUrl = null;
      let docUrl = null;
      let docName = null;

      const uploadFile = async (file, folder) => {
        const ext = file.uri.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const mime = file.mimeType || `image/${ext === 'pdf' ? 'pdf' : 'jpeg'}`;
        const blob = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.responseType = 'blob';
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = () => reject(new Error('Failed to read file'));
          xhr.open('GET', file.uri, true);
          xhr.send();
        });
        const { error: uploadError } = await supabase.storage
          .from(folder)
          .upload(fileName, blob, { contentType: mime, upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from(folder)
          .getPublicUrl(fileName);
        return publicUrl;
      };

      for (const item of mediaItems) {
        if (item.type === 'image') {
          imageUrls.push(await uploadFile(item.data, 'posts'));
        } else if (item.type === 'video') {
          videoUrl = await uploadFile(item.data, 'posts');
        } else if (item.type === 'document') {
          docUrl = await uploadFile(item.data, 'posts');
          docName = item.data.name || null;
        } else if (item.type === 'gif') {
          gifUrl = item.data.uri;
        }
      }

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          text: text.trim() || null,
          image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          video_url: videoUrl,
          gif_url: gifUrl,
          document_url: docUrl,
          document_name: docName,
          bg_color: bgColor,
          visibility,
        });

      if (insertError) throw insertError;

      Alert.alert(t('successTitle'), t('postCreated'));
      onBack();
    } catch (err) {
      Alert.alert(t('error'), err.message);
    } finally {
      setPosting(false);
    }
  };

  const hasVideo = mediaItems.some(m => m.type === 'video');
  const textColor = bgColor === BG_COLORS[0] ? colors.onSurface : '#fff';
  const textColorMuted = bgColor === BG_COLORS[0] ? colors.onSurfaceVariant : 'rgba(255,255,255,0.6)';

  const expandedHeight = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  const dragOffset = panY.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [200, 0, -200],
    extrapolate: 'clamp',
  });
  const sheetHeight = Animated.add(expandedHeight, dragOffset);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.onSurface }]}>{t('createPost')}</Text>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: colors.primaryContainer }]}
          onPress={handlePost}
          disabled={posting}
        >
          <Text style={[styles.postBtnText, { color: colors.onPrimaryContainer }]}>
            {posting ? t('posting') : t('post')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentArea}>
          <TextInput
            style={[styles.textInput, { color: textColor }]}
            placeholder={t('postPlaceholder')}
            placeholderTextColor={textColorMuted}
            value={text}
            onChangeText={setText}
            multiline
          />

          {mediaItems.length > 0 && (
            <View>
              <View style={styles.imagesRow}>
                {mediaItems.filter(m => m.type === 'image').map((item, idx) => (
                  <View key={item.id} style={styles.mediaImageItem}>
                    <Image source={{ uri: item.data.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <View style={styles.mediaActions}>
                      <TouchableOpacity style={styles.mediaActionBtn} onPress={() => removeMedia(item.id)}>
                        <MaterialIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                      {hasVideo && (
                        <TouchableOpacity style={styles.mediaActionBtn} onPress={() => moveMedia(item.id, -1)}>
                          <MaterialIcons name="arrow-upward" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              {mediaItems.filter(m => m.type !== 'image').map((item, idx) => (
                <View key={item.id} style={[styles.mediaPreview, { marginTop: 8 }]}>
                  {item.type === 'video' && (
                    <View style={[styles.mediaPreviewVideo, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <MaterialIcons name="play-circle-outline" size={48} color={colors.primary} />
                      <Text style={[styles.videoLabel, { color: colors.onSurfaceVariant }]}>Video selected</Text>
                    </View>
                  )}
                  {item.type === 'gif' && (
                    <Image source={{ uri: item.data.uri }} style={styles.mediaPreviewImage} resizeMode="contain" />
                  )}
                  {item.type === 'document' && (
                    <View style={[styles.docPreview, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, marginTop: 0, marginBottom: 0 }]}>
                      <MaterialIcons name="description" size={24} color={colors.primary} />
                      <Text style={[styles.docName, { color: colors.onSurface }]} numberOfLines={1}>{item.data.name || 'Document'}</Text>
                    </View>
                  )}
                  <View style={[styles.mediaActions, { top: 8, right: 8 }]}>
                    <TouchableOpacity style={styles.mediaActionBtn} onPress={() => removeMedia(item.id)}>
                      <MaterialIcons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                    {hasVideo && (
                      <TouchableOpacity style={styles.mediaActionBtn} onPress={() => moveMedia(item.id, -1)}>
                        <MaterialIcons name="arrow-upward" size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomSheet, { backgroundColor: colors.surfaceContainer }]}>
        <View {...panResponder.panHandlers} style={styles.sheetHandle}>
          <TouchableOpacity activeOpacity={0.7} onPress={toggleSheet} style={{ padding: 20 }}>
            <View style={[styles.handleBar, { backgroundColor: colors.surfaceVariant }]} />
          </TouchableOpacity>
        </View>

        <View style={styles.userInfoRow}>
          <View style={styles.userAvatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.onSurface }]}>
              {profile?.full_name || profile?.username || t('you')}
            </Text>
            <TouchableOpacity
              style={[styles.visibilityChip, { backgroundColor: colors.surfaceContainerHigh }]}
              onPress={() => setShowVisibility(!showVisibility)}
            >
              <MaterialIcons
                name={VISIBILITY_OPTIONS.find(v => v.key === visibility).icon}
                size={14}
                color={colors.onSurfaceVariant}
              />
              <Text style={[styles.visibilityChipText, { color: colors.onSurfaceVariant }]}>
                {t(visibility)}
              </Text>
              <MaterialIcons
                name={showVisibility ? 'expand-less' : 'expand-more'}
                size={14}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        {showVisibility && (
          <View style={[styles.visDropdown, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            {VISIBILITY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.visOption, visibility === opt.key && { backgroundColor: colors.primaryContainer }]}
                onPress={() => { setVisibility(opt.key); setShowVisibility(false); }}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={18}
                  color={visibility === opt.key ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                />
                <Text style={[styles.visOptionText, { color: visibility === opt.key ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                  {t(opt.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.surfaceContainerHigh }]} onPress={pickImage}>
            <MaterialIcons name="image" size={24} color={colors.primary} />
            <Text style={styles.actionLabel}>{t('photo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.surfaceContainerHigh }]} onPress={pickVideo}>
            <MaterialIcons name="movie" size={24} color={colors.secondary} />
            <Text style={styles.actionLabel}>{t('video')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.surfaceContainerHigh }]} onPress={pickCamera}>
            <MaterialIcons name="photo-camera" size={24} color={colors.tertiary} />
            <Text style={styles.actionLabel}>{t('camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => { setShowGifPicker(true); }}>
            <MaterialIcons name="gif-box" size={24} color={colors.primaryContainer} />
            <Text style={styles.actionLabel}>GIF</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.expandableArea, { maxHeight: sheetHeight, overflow: 'hidden' }]}>
          <View style={styles.bgSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BG_COLORS.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.bgCircle, { backgroundColor: c }, bgColor === c && styles.bgCircleActive]}
                  onPress={() => setBgColor(c)}
                />
              ))}
            </ScrollView>
            <Text style={[styles.bgLabel, { color: colors.onSurfaceVariant }]}>Bg</Text>
          </View>

          <TouchableOpacity style={[styles.docRow, { backgroundColor: colors.surfaceContainerLow }]} onPress={pickDocument}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialIcons name="description" size={20} color={colors.outline} />
              <Text style={[styles.docRowText, { color: colors.onSurface }]}>{t('addDocument')}</Text>
            </View>
            <MaterialIcons name="attach-file" size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal visible={showGifPicker} animationType="slide" onRequestClose={() => setShowGifPicker(false)}>
        <View style={[styles.gifModal, { backgroundColor: colors.background }]}>
          <View style={[styles.gifModalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowGifPicker(false)}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.gifModalTitle, { color: colors.onSurface }]}>GIF</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={[styles.gifSearchWrap, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={[styles.gifSearchInput, { color: colors.onSurface }]}
              placeholder="Search GIFs..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={gifSearch}
              onChangeText={setGifSearch}
            />
          </View>

          {gifLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.onSurfaceVariant }}>{t('loading')}</Text>
            </View>
          ) : (
            <FlatList
              data={gifResults}
              numColumns={2}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const url = item.images?.fixed_height_small?.url;
                return (
                  <TouchableOpacity style={styles.gifItem} onPress={() => selectGif(item)}>
                    {url && <Image source={{ uri: url }} style={styles.gifImage} />}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ padding: 8 }}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    closeBtn: { padding: 4 },
    topTitle: { fontFamily: FONTS.headlineMd, fontSize: 22, fontWeight: '600' },
    postBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    postBtnText: { fontFamily: FONTS.labelMd, fontSize: 12, fontWeight: '700' },
    contentArea: { padding: 16, minHeight: 250 },
    textInput: { fontFamily: FONTS.bodyLg, fontSize: 16, minHeight: 120, textAlignVertical: 'top', lineHeight: 24 },
    mediaPreview: { position: 'relative', marginTop: 16, borderRadius: 12, overflow: 'hidden' },
    mediaPreviewImage: { width: '100%', height: 200, borderRadius: 12, maxHeight: 360 },
    imagesRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    mediaImageItem: { position: 'relative', flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
    mediaPreviewVideo: { width: '100%', height: 200, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
    videoLabel: { fontFamily: FONTS.labelMd, fontSize: 12 },
    mediaActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
    mediaActionBtn: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 4 },
    removeMediaBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 4 },
    docPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 10, marginTop: 16 },
    docName: { flex: 1, fontFamily: FONTS.bodyMd, fontSize: 13 },
    bottomSheet: {
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    },
    sheetHandle: { alignItems: 'center', paddingVertical: 6 },
    handleBar: { width: 36, height: 4, borderRadius: 2 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    userAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    userName: { fontFamily: FONTS.bodyMd, fontSize: 13, fontWeight: '600' },
    visibilityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start' },
    visibilityChipText: { fontFamily: FONTS.labelMd, fontSize: 10 },
    visDropdown: { borderWidth: 1, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
    visOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
    visOptionText: { fontFamily: FONTS.bodyMd, fontSize: 13 },
    actionGrid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    actionItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 4 },
    actionLabel: { fontFamily: FONTS.labelMd, fontSize: 9, color: colors.onSurfaceVariant },
    expandableArea: {},
    bgSection: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    bgCircle: { width: 24, height: 24, borderRadius: 12, marginRight: 4 },
    bgCircleActive: { borderWidth: 2.5, borderColor: '#fff' },
    bgLabel: { fontFamily: FONTS.labelMd, fontSize: 9 },
    docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, marginBottom: 4 },
    docRowText: { fontFamily: FONTS.bodyMd, fontSize: 13 },
    gifModal: { flex: 1 },
    gifModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24, height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24) },
    gifModalTitle: { fontFamily: FONTS.headlineMd, fontSize: 20, fontWeight: '600' },
    gifSearchWrap: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, height: 44, borderRadius: 10, borderWidth: 1, gap: 8 },
    gifSearchInput: { flex: 1, fontFamily: FONTS.bodyMd, fontSize: 14 },
    gifItem: { flex: 1, margin: 4, borderRadius: 8, overflow: 'hidden' },
    gifImage: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  });
}
