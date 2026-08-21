import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Switch,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../i18n/LocaleContext';
import { useTheme } from '../../contexts/ThemeContext';

const DEFAULT_COVER = '#201F1F';

export default function EditProfileScreen({ onBack }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState(['']);
  const [openToWork, setOpenToWork] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  const [cvName, setCvName] = useState('');

  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);

  const originalCvUrlRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setDisplayName(data.full_name || '');
        setUsername(data.username || '');
        setJobTitle(data.job_title || '');
        setCompany(data.company || '');
        setLocation(data.location || '');
        setBio(data.bio || '');
        setSocialLinks(data.social_links?.length ? data.social_links : ['']);
        setOpenToWork(data.open_to_work || false);
        setAvatarUrl(data.avatar_url);
        setCoverUrl(data.cover_url);
        setCvUrl(data.cv_url);
        originalCvUrlRef.current = data.cv_url || null;
        if (data.cv_url) {
          setCvName(decodeURIComponent(data.cv_url.split('/').pop() || 'CV.pdf'));
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkUsername = async (value) => {
    if (!value || value === username) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', value)
      .neq('id', profileId)
      .maybeSingle();
    if (data) {
      setUsernameError(t('usernameTaken'));
    } else {
      setUsernameError('');
    }
  };

  const getAsset = (result) => {
    if (result.assets?.[0]) return result.assets[0];
    if (result.uri) return result;
    return null;
  };

  const pickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = getAsset(result);
    if (!asset) return;
    if (type === 'avatar') {
      setAvatarFile(asset);
      setAvatarUrl(asset.uri);
    } else {
      setCoverFile(asset);
      setCoverUrl(asset.uri);
    }
  };

  const pickCv = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = getAsset(result);
    if (!asset) return;
    setCvFile(asset);
    setCvName(sanitizeFileName(asset.name || 'CV.pdf'));
  };

  const sanitizeFileName = (name) =>
    (name || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');

  const uploadFile = async (file, bucket, customName) => {
    if (!file || !file.uri) return null;
    const ext = file.uri.split('.').pop() || 'jpg';
    const baseName = customName
      ? sanitizeFileName(customName)
      : `${Date.now()}.${ext}`;
    const fileName = `${profileId}/${baseName}`;
    const mime = file.mimeType || `image/${ext === 'pdf' ? 'pdf' : 'jpeg'}`;

    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Failed to read file'));
      xhr.open('GET', file.uri, true);
      xhr.send();
    });

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, { contentType: mime, upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSave = async () => {
    if (usernameError) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const uid = user.id;

      let newAvatarUrl = avatarUrl;
      let newCoverUrl = coverUrl;
      let newCvUrl = cvUrl;

      try {
        if (avatarFile) newAvatarUrl = await uploadFile(avatarFile, 'avatars');
        if (coverFile) newCoverUrl = await uploadFile(coverFile, 'covers');
        if (cvFile) newCvUrl = await uploadFile(cvFile, 'cvs', cvName);
      } catch (uploadErr) {
        Alert.alert('Upload Error', uploadErr.message);
        setSaving(false);
        return;
      }

      const updates = {
        id: uid,
        full_name: displayName,
        email: user.email,
        username: username || null,
        job_title: jobTitle || null,
        company: company || null,
        location: location || null,
        bio: bio || null,
        social_links: socialLinks.filter(Boolean),
        open_to_work: openToWork,
        avatar_url: newAvatarUrl,
        cover_url: newCoverUrl,
        cv_url: newCvUrl,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving profile:', JSON.stringify(updates, null, 2));

      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      console.log('Upsert:', error ? JSON.stringify(error) : 'OK');
      if (error) throw error;

      const { data: verifyData, error: verifyErr } = await supabase
        .from('profiles')
        .select('cv_url, updated_at')
        .eq('id', uid)
        .maybeSingle();
      console.log('Verify after save:', JSON.stringify({ verifyData, verifyErr }, null, 2));

      if (cvFile && newCvUrl) {
        setTimeout(() => {
          supabase.functions.invoke('cv-analyze', { body: { cvUrl: newCvUrl } })
            .then(() => console.log('cv-analyze OK'))
            .catch((fnErr) => console.warn('cv-analyze failed:', fnErr.message || fnErr));
        }, 0);
      }

      if (originalCvUrlRef.current && originalCvUrlRef.current !== newCvUrl) {
        const oldPath = originalCvUrlRef.current.split('/public/cvs/')[1];
        if (oldPath) {
          setTimeout(() => {
            supabase.storage
              .from('cvs')
              .remove([oldPath])
              .then((res) => console.log('Old CV removed:', oldPath, res.error ? JSON.stringify(res.error) : 'OK'))
              .catch((delErr) => console.warn('Old CV remove failed:', delErr.message || delErr));
          }, 0);
        }
      }

      onBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => setSocialLinks([...socialLinks, '']);
  const updateLink = (index, value) => {
    const newLinks = [...socialLinks];
    newLinks[index] = value;
    setSocialLinks(newLinks);
  };
  const removeLink = (index) => {
    const newLinks = socialLinks.filter((_, i) => i !== index);
    setSocialLinks(newLinks.length ? newLinks : ['']);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{t('editProfile')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? t('saving') : t('save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Section */}
        <View style={styles.mediaSection}>
          <TouchableOpacity style={styles.coverWrap} onPress={() => pickImage('cover')}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: DEFAULT_COVER }]} />
            )}
            <View style={styles.coverIconWrap}>
              <MaterialIcons name="add-a-photo" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={() => pickImage('avatar')}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={40} color={colors.onSurfaceVariant} />
                </View>
              )}
              <View style={styles.avatarOverlay}>
                <MaterialIcons name="camera-enhance" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('displayName')}</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={colors.outlineVariant}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('username')}</Text>
              <View style={[styles.inputWithPrefix, usernameError ? styles.inputError : null]}>
                <Text style={styles.prefix}>@</Text>
                <TextInput
                  style={styles.inputPrefix}
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    setUsernameError('');
                  }}
                  onBlur={() => checkUsername(username)}
                  placeholder="username"
                  placeholderTextColor={colors.outlineVariant}
                  autoCapitalize="none"
                />
              </View>
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : null}
            </View>
          </View>

          {/* Professional Info */}
          <View style={styles.proCard}>
            <View style={styles.proCardHeader}>
              <MaterialIcons name="work" size={18} color={colors.secondary} />
              <Text style={styles.proCardTitle}>Professional Info</Text>
            </View>
            <View style={styles.proGrid}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>{t('jobTitle')}</Text>
                <TextInput
                  style={styles.inputSm}
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Nothing"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>{t('company')}</Text>
                <TextInput
                  style={styles.inputSm}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Nothing"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('location')}</Text>
              <View style={styles.inputWithIcon}>
                <MaterialIcons name="location-on" size={18} color={colors.outline} />
                <TextInput
                  style={styles.inputIcon}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Nothing"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('bio')}</Text>
            <TextInput
              style={styles.textArea}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the world about yourself..."
              placeholderTextColor={colors.outlineVariant}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{bio.length} / 250</Text>
            </View>
          </View>

          {/* Social Links */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>{t('socialLinks').toUpperCase()}</Text>
            {socialLinks.map((link, index) => (
              <View key={index} style={styles.linkRow}>
                <MaterialIcons name="link" size={18} color={colors.primary} />
                <TextInput
                  style={styles.linkInput}
                  value={link}
                  onChangeText={(val) => updateLink(index, val)}
                  placeholder="https://"
                  placeholderTextColor={colors.outlineVariant}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => removeLink(index)}>
                  <MaterialIcons name="delete" size={18} color={colors.outline} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addLink} onPress={addLink}>
              <MaterialIcons name="add" size={18} color={colors.onSurfaceVariant} />
              <Text style={styles.addLinkText}>{t('addLink')}</Text>
            </TouchableOpacity>
          </View>

          {/* CV */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>{t('cvResume').toUpperCase()}</Text>
            <TouchableOpacity style={styles.cvRow} onPress={pickCv}>
              <MaterialIcons name="description" size={22} color={colors.primary} />
              <View style={styles.cvInfo}>
                <Text style={styles.cvLabel}>
                  {cvName || t('uploadCv')}
                </Text>
                <Text style={styles.cvHint}>{t('pdfHint')}</Text>
              </View>
              <MaterialIcons name="file-upload" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            {cvUrl && (
              <TouchableOpacity
                style={styles.cvRemove}
                onPress={() => {
                  setCvUrl(null);
                  setCvFile(null);
                  setCvName('');
                }}
              >
                <MaterialIcons name="close" size={16} color={colors.error} />
                <Text style={styles.cvRemoveText}>Remove CV</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>{t('showBadges')}</Text>
              <Text style={styles.toggleSub}>
                {t('displayOpenToWork')}
              </Text>
            </View>
            <Switch
              value={openToWork}
              onValueChange={setOpenToWork}
              trackColor={{ false: colors.surfaceVariant, true: colors.secondary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    backgroundColor: 'rgba(19,19,19,0.8)',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 6,
  },
  topBarTitle: {
    fontFamily: FONTS.headlineMd,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  mediaSection: {
    position: 'relative',
  },
  coverWrap: {
    height: 180,
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
  },
  coverIconWrap: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarSection: {
    paddingHorizontal: 16,
    marginTop: -40,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.background,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 24,
  },
  fieldGroup: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
  },
  input: {
    height: 48,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.error,
    marginLeft: 4,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingLeft: 14,
  },
  prefix: {
    fontSize: 14,
    color: colors.outline,
    fontFamily: FONTS.bodyMd,
  },
  inputPrefix: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 4,
    fontSize: 14,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  proCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 16,
  },
  proCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proCardTitle: {
    fontFamily: FONTS.headlineMd,
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '600',
  },
  proGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
    gap: 6,
  },
  inputSm: {
    height: 42,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingLeft: 10,
    gap: 6,
  },
  inputIcon: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  textArea: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
    minHeight: 100,
  },
  charCount: {
    alignItems: 'flex-end',
  },
  charCountText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.outline,
  },
  sectionLabel: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 10,
  },
  linkInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontFamily: FONTS.bodyMd,
    color: colors.onSurface,
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
  },
  addLinkText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  cvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 14,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 12,
  },
  cvInfo: {
    flex: 1,
  },
  cvLabel: {
    fontFamily: FONTS.bodyMd,
    fontSize: 13,
    color: colors.onSurface,
  },
  cvHint: {
    fontFamily: FONTS.labelMd,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  cvRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -8,
  },
  cvRemoveText: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.error,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontFamily: FONTS.bodyMd,
    fontSize: 14,
    color: colors.onSurface,
  },
  toggleSub: {
    fontFamily: FONTS.labelMd,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  });
}
