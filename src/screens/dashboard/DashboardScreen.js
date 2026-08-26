import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Image, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import BottomTabBar from '../../components/BottomTabBar';
import StoryViewer from '../../components/StoryViewer';
import HomeScreen from '../home/HomeScreen';
import DiscoverScreen from '../discover/DiscoverScreen';
import VacanciesScreen from '../vacancies/VacanciesScreen';
import InboxScreen from '../inbox/InboxScreen';
import ConversationScreen from '../inbox/ConversationScreen';
import NetworkScreen from '../network/NetworkScreen';
import ProfileScreen from '../profile/ProfileScreen';
import EditProfileScreen from '../profile/EditProfileScreen';
import SettingsScreen from '../settings/SettingsScreen';
import FollowersScreen from '../network/FollowersScreen';
import FollowingScreen from '../network/FollowingScreen';
import PostDetailScreen from '../profile/PostDetailScreen';
import CreatePostScreen from '../posts/CreatePostScreen';
import JobDetailScreen from '../vacancies/JobDetailScreen';
import CreateJobScreen from '../vacancies/CreateJobScreen';
import EmployerApplicationsScreen from '../vacancies/EmployerApplicationsScreen';
import NotificationsScreen from '../notifications/NotificationsScreen';
import SavedPostsScreen from '../profile/SavedPostsScreen';
import CommunityScreen from '../discover/CommunityScreen';
import AdminHomeScreen from '../admin/AdminHomeScreen';

const screens = {
  home: HomeScreen,
  discover: DiscoverScreen,
  vacancies: VacanciesScreen,
  network: NetworkScreen,
  profile: ProfileScreen,
  admin: AdminHomeScreen,
};

export default function DashboardScreen({ onSignOut }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [subScreen, setSubScreen] = useState(null);
  const [screenProfileId, setScreenProfileId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (mounted) setIsAdmin(!!prof?.is_admin);
      } catch (err) {
        console.error(err);
      }
    };
    checkAdmin();
    return () => { mounted = false; };
  }, []);

  const handleEditProfile = () => setSubScreen('editProfile');
  const handleSettings = () => setSubScreen('settings');
  const handleBack = () => setSubScreen(null);
  const handleViewFollowers = (type, profileId) => {
    setScreenProfileId(profileId || null);
    setSubScreen(type === 'following' ? 'following' : 'followers');
  };
  const handleViewProfile = (profileId) => {
    setScreenProfileId(profileId);
    setSubScreen('profileView');
  };
  const handleViewSaved = () => setSubScreen('saved');
  const handleViewPost = (post) => {
    setSelectedPost(post);
    setSubScreen('postDetail');
  };
  const handleCreatePost = () => setSubScreen('createPost');
  const handleViewJob = (job) => {
    setSelectedJob(job);
    setSubScreen('jobDetail');
  };
  const handlePostJob = () => setSubScreen('createJob');
  const handleAdminJobs = () => setSubScreen('adminHome');
  const handleViewCommunity = (community) => {
    setSelectedCommunity(community);
    setSubScreen('community');
  };
  const handleViewStory = (story) => setSelectedStory(story);
  const handleCloseStory = () => setSelectedStory(null);
  const handleOpenInbox = () => setSubScreen('inbox');
  const handleOpenNotifications = () => setSubScreen('notifications');
  const handleViewConversation = (conv) => {
    setSelectedConversation(conv);
    setSubScreen('conversation');
  };
  const handleCloseConversation = () => { setSelectedConversation(null); setSubScreen('inbox'); };

  const handleOpenChat = (convData) => {
    setSelectedConversation(convData);
    setSubScreen('conversation');
  };

  const handleAddStory = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = asset.uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const mime = asset.mimeType || 'image/jpeg';
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'blob';
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Failed to read file'));
        xhr.open('GET', asset.uri, true);
        xhr.send();
      });
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, blob, { contentType: mime, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);
      const { error } = await supabase.from('stories').insert({
        user_id: user.id, media_url: publicUrl, type: 'image',
      });
      if (error) throw error;
      Alert.alert('Story', 'Story added successfully!');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (selectedStory) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StoryViewer userStory={selectedStory} onClose={handleCloseStory} />
      </View>
    );
  }

  if (selectedConversation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ConversationScreen
          conversationId={selectedConversation.id}
          onBack={handleCloseConversation}
          restricted={selectedConversation.restricted || false}
          onViewProfile={handleViewProfile}
          partnerId={selectedConversation.partnerId}
        />
      </View>
    );
  }

  if (subScreen === 'inbox') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <InboxScreen onViewConversation={handleViewConversation} onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'notifications') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NotificationsScreen onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'conversation' && selectedConversation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ConversationScreen
          conversationId={selectedConversation.id}
          onBack={handleCloseConversation}
          restricted={selectedConversation.restricted || false}
          onViewProfile={handleViewProfile}
          partnerId={selectedConversation.partnerId}
        />
      </View>
    );
  }

  if (subScreen === 'followers') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FollowersScreen profileId={screenProfileId} onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'profileView' && screenProfileId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ProfileScreen
          onSignOut={onSignOut}
          onEditProfile={handleEditProfile}
          onSettings={handleSettings}
          onBack={handleBack}
          profileId={screenProfileId}
          onViewFollowers={(type) => handleViewFollowers(type, screenProfileId)}
          onViewPost={handleViewPost}
        />
      </View>
    );
  }

  if (subScreen === 'following') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FollowingScreen profileId={screenProfileId} onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'editProfile') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EditProfileScreen onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'saved') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SavedPostsScreen onBack={handleBack} onViewPost={handleViewPost} />
      </View>
    );
  }

  if (subScreen === 'settings') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SettingsScreen
          onSignOut={onSignOut}
          onBack={handleBack}
        />
      </View>
    );
  }

  if (subScreen === 'postDetail') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PostDetailScreen post={selectedPost} onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'createPost') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CreatePostScreen onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'jobDetail' && selectedJob) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <JobDetailScreen job={selectedJob} onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'createJob') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CreateJobScreen onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'employerApps') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmployerApplicationsScreen
          onBack={handleBack}
          onOpenChat={handleOpenChat}
          onViewProfile={handleViewProfile}
        />
      </View>
    );
  }

  if (subScreen === 'adminHome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHomeScreen onBack={handleBack} />
      </View>
    );
  }

  if (subScreen === 'community' && selectedCommunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CommunityScreen community={selectedCommunity} onBack={handleBack} onViewPost={handleViewPost} />
      </View>
    );
  }

  const ScreenComponent = screens[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeTab === 'home' && (
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Image source={require('../../../assets/logo2.png')} style={styles.logo} resizeMode="contain" />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleOpenNotifications}>
              <MaterialIcons name="notifications" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleOpenInbox}>
              <MaterialIcons name="message" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {activeTab === 'home' && (
        <View style={[styles.createPostBar, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <TouchableOpacity onPress={handleCreatePost} style={styles.addBtn}>
            <MaterialIcons name="add-circle" size={26} color={colors.primaryContainer} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inputWrap, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '30' }]}
            onPress={handleCreatePost}
            activeOpacity={0.7}
          >
            <Text style={[styles.inputText, { color: colors.onSurfaceVariant }]}>
              {"What's on your head?"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primaryContainer }]} onPress={handleCreatePost}>
            <MaterialIcons name="send" size={18} color={colors.onPrimaryContainer} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        <ScreenComponent
          onSignOut={onSignOut}
          onEditProfile={handleEditProfile}
          onSettings={handleSettings}
          onBack={activeTab === 'admin' ? () => setActiveTab('home') : undefined}
          onViewPost={handleViewPost}
          onViewStory={handleViewStory}
          onAddStory={handleAddStory}
          onViewConversation={handleViewConversation}
          onViewJob={handleViewJob}
          onPostJob={handlePostJob}
          onEmployerApps={() => setSubScreen('employerApps')}
          onAdminJobs={handleAdminJobs}
          onViewCommunity={handleViewCommunity}
          onViewProfile={handleViewProfile}
          onViewSaved={handleViewSaved}
          onViewFollowers={(type) => handleViewFollowers(type, activeTab === 'profile' ? null : activeTab)}
        />
      </View>
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} isAdmin={isAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24),
    height: 50 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
  },
  logo: {
    width: 100,
    height: 32,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  inputText: {
    fontFamily: FONTS.bodyMd,
    fontSize: 14,
    flex: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
