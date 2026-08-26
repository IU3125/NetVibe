import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, FlatList,
  StyleSheet, Platform, StatusBar, Modal, ActivityIndicator, Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio, useAudioRecorder, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import CallScreen from '../calls/CallScreen';

const isIos = Platform.OS === 'ios';
const PAGE_SIZE = 30;
const QUICK_REACTS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJI_GRID = ['😀','😁','😂','🤣','😊','😍','😘','😜','🤔','😎','😢','😡','👍','👎','👏','🙏','💪','🔥','❤️','💯','🎉','✨','🤝','😴'];

const formatClock = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getDayLabel = (d) => {
  const date = new Date(d);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const REPORT_REASONS = ['Spam or scam', 'Inappropriate content', 'Harassment', 'Offensive language', 'Other'];

export default function ConversationScreen({ conversationId, onBack, restricted, onViewProfile, partnerId }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [replyMap, setReplyMap] = useState({});
  const [other, setOther] = useState(null);
  const [myId, setMyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [showEmoji, setShowEmoji] = useState(null);
  const [showReport, setShowReport] = useState(null);
  const [reportReason, setReportReason] = useState(null);
  const [viewerUri, setViewerUri] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [callId, setCallId] = useState(null);
  const [callType, setCallType] = useState('audio');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.isRecording) {
      setRecSeconds(Math.round(status.durationMillis / 1000));
    }
  });

  const listRef = useRef(null);
  const typingTimer = useRef(null);
  const typingChannelRef = useRef(null);
  const lastSentAt = useRef(0);

  const headerHeight = 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setRecSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const fetchMessages = useCallback(async (beforeCreatedAt) => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []).slice().reverse();
      return rows;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [conversationId]);

  const fetchReactions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji');
      const map = {};
      (data || []).forEach(r => {
        if (!map[r.message_id]) map[r.message_id] = {};
        if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { count: 0, mine: false };
        map[r.message_id][r.emoji].count += 1;
        if (r.user_id === myId) map[r.message_id][r.emoji].mine = true;
      });
      setReactions(map);
    } catch (err) {
      console.error(err);
    }
  }, [myId]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const rows = await fetchMessages();
    setMessages(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [fetchMessages]);

  useEffect(() => {
    loadInitial();
    fetchReactions();
  }, [loadInitial, fetchReactions]);

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      const { data: others } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);
      const otherId = others && others.length ? others[0].user_id : null;
      if (!otherId) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, is_online, last_seen')
        .eq('id', otherId)
        .single();
      if (prof) setOther({ id: otherId, ...prof });
      const { data: mine } = await supabase
        .from('conversation_participants')
        .select('last_read_at, muted_until')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();
      if (mine?.last_read_at) {
        const { data: otherCp } = await supabase
          .from('conversation_participants')
          .select('last_read_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', otherId)
          .single();
        if (otherCp?.last_read_at) setOtherReadAt(otherCp.last_read_at);
      }
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    };
    boot();
  }, [conversationId]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const m = payload.new;
        if (m.sender_id === myId) return;
        setMessages(prev => [...prev, m]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => loadInitial())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, () => fetchReactions())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversation_participants',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        if (payload.new.user_id !== myId && payload.new.last_read_at) {
          setOtherReadAt(payload.new.last_read_at);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, myId, fetchReactions, loadInitial]);

  useEffect(() => {
    let active = true;
    const typingChannel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: `typing:${conversationId}` } },
    });
    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const anyTyping = Object.values(state).some(rows =>
          (rows || []).some(r => r.userId !== myId && r.typing)
        );
        if (active) setOtherTyping(anyTyping);
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && !active) {
          typingChannel.unsubscribe();
        }
      });
    typingChannelRef.current = typingChannel;
    return () => {
      active = false;
      typingChannel.untrack();
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, myId]);

  const trackTyping = useCallback((typing) => {
    const ch = typingChannelRef.current;
    if (!ch || !myId) return;
    try {
      if (typing) {
        ch.track({ userId: myId, typing: true });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => trackTyping(false), 8000);
      } else {
        ch.track({ userId: myId, typing: false });
      }
    } catch (err) {
      // typing presence is best-effort
    }
  }, [myId]);

  useEffect(() => {
    if (editing) {
      trackTyping(false);
    } else if (input.trim()) {
      trackTyping(true);
    } else {
      trackTyping(false);
    }
    return () => {};
  }, [input, editing, trackTyping]);

  const loadEarlier = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const rows = await fetchMessages(oldest.created_at);
    setMessages(prev => [...rows, ...prev]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const resolveReplies = useCallback(async (rows) => {
    const ids = rows.filter(m => m.reply_to_id).map(m => m.reply_to_id);
    const missing = ids.filter(id => !replyMap[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from('messages')
      .select('id, content, image_url, deleted_at, sender_id')
      .in('id', missing);
    if (!data) return;
    setReplyMap(prev => {
      const next = { ...prev };
      data.forEach(m => { next[m.id] = m; });
      return next;
    });
  }, [replyMap]);

  useEffect(() => { resolveReplies(messages); }, [messages, resolveReplies]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    if (editing) {
      setSending(true);
      const { error } = await supabase
        .from('messages')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (!error) loadInitial();
      setSending(false);
      setEditing(null);
      setInput('');
      setReplyTo(null);
      trackTyping(false);
      return;
    }
    setSending(true);
    const now = new Date().toISOString();
    const row = {
      conversation_id: conversationId,
      content,
      reply_to_id: replyTo ? replyTo.id : null,
      created_at: now,
    };
    const { data, error } = await supabase.from('messages').insert(row).select().single();
    setSending(false);
    if (!error) {
      setMessages(prev => [...prev, data]);
      setInput('');
      setReplyTo(null);
      trackTyping(false);
    } else {
      console.error(error);
    }
  };

  const sendImage = async (uri) => {
    if (sendingImage) return;
    setSendingImage(true);
    try {
      const ext = uri.split('.').pop() || 'jpg';
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const filePath = `chat/${conversationId}/${Date.now()}.${ext}`;
      const uploaded = await uploadBlob(uri, filePath);
      if (!uploaded) return;
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        image_url: uploaded,
        reply_to_id: replyTo ? replyTo.id : null,
      }).select().single();
      if (!error) setMessages(prev => [...prev, data]);
      setReplyTo(null);
      trackTyping(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingImage(false);
    }
  };

  const uploadBlob = async (uri, filePath) => {
    const fileType = 'image/' + (uri.split('.').pop() === 'png' ? 'png' : 'jpeg');
    let res = await fetch(uri);
    let blob = await res.blob();
    if (blob.size > 0) {
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(filePath, blob, { contentType: fileType, cacheControl: '3600', upsert: true });
      blob = null;
      if (error) {
        console.error('upload failed:', error);
        return null;
      }
      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(data.path);
      return pub.publicUrl;
    }
    if (blob) blob = null;
    return null;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) sendImage(result.assets[0].uri);
  };

  const startCall = async (type) => {
    if (!other) return;
    setCallType(type);
    const roomName = `call-${conversationId}-${Date.now()}`;
    const { data, error } = await supabase.from('calls').insert({
      caller_id: myId,
      callee_id: other.id,
      type,
      status: 'ringing',
      room_name: roomName,
    }).select().single();
    if (!error && data) setCallId(data.id);
  };

  const startRecording = async () => {
    const perm = await Audio.requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecSeconds(0);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const seconds = recSeconds;
      if (uri) await sendVoice(uri, seconds);
    } catch (err) {
      console.error(err);
    }
  };

  const sendVoice = async (uri, duration) => {
    setSendingVoice(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const filePath = `${user.id}/${Date.now()}.m4a`;
      const uploaded = await uploadBlob(uri, filePath);
      if (!uploaded) return;
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        voice_url: uploaded,
        voice_duration: Math.max(1, Math.round(duration)),
        reply_to_id: replyTo ? replyTo.id : null,
      }).select().single();
      if (!error) setMessages(prev => [...prev, data]);
      setReplyTo(null);
      trackTyping(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingVoice(false);
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const key = `${msg.id}`;
    const current = reactions[key]?.[emoji];
    if (current?.mine) {
      await supabase.from('message_reactions')
        .delete()
        .eq('message_id', msg.id)
        .eq('user_id', myId)
        .eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions')
        .upsert({ message_id: msg.id, user_id: myId, emoji }, { onConflict: 'message_id,user_id,emoji' });
    }
    fetchReactions();
  };

  const doReport = async (msg) => {
    if (!reportReason) return;
    await supabase.from('reports').insert({
      content_type: 'message',
      content_id: msg.id,
      reason: reportReason,
      description: '',
    });
    setShowReport(null);
    setReportReason(null);
  };

  const deleteMessage = async (msg) => {
    await supabase.from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', msg.id);
    setActionMsg(null);
    loadInitial();
  };

  const otherIsOnline = useMemo(() => {
    if (!other) return false;
    if (other.is_online) return true;
    const lastSeen = other.last_seen ? new Date(other.last_seen).getTime() : 0;
    return lastSeen > 0 && Date.now() - lastSeen < 120000;
  }, [other]);

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_id === myId;
    const showDay = index === 0 || getDayLabel(item.created_at) !== getDayLabel(messages[index - 1].created_at);
    const isDeleted = !!item.deleted_at;
    const isEdited = !!item.edited_at;
    const read = !isMine || new Date(item.created_at) <= new Date(otherReadAt || 0);
    const msgReactions = reactions[item.id];
    const replyMsg = item.reply_to_id ? replyMap[item.reply_to_id] : null;

    return (
      <View key={item.id}>
        {showDay && (
          <View style={styles.dayWrap}>
            <Text style={[styles.dayText, { color: colors.onSurfaceVariant }]}>{getDayLabel(item.created_at)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}
          activeOpacity={0.7}
          delayLongPress={300}
          onLongPress={() => setActionMsg(item)}
        >
          {!isMine && (
            other?.avatar_url ? (
              <Image source={{ uri: other.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialIcons name="person" size={16} color={colors.onSurfaceVariant} />
              </View>
            )
          )}
          <View style={[styles.bubble, isMine ? { backgroundColor: colors.primaryContainer } : { backgroundColor: colors.surfaceContainerLow }]}>
            {replyMsg && (
              <View style={[styles.replyBox, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.replyAuthor, { color: colors.primary }]} numberOfLines={1}>
                  {replyMsg.sender_id === myId ? 'You' : (other?.full_name || 'User')}
                </Text>
                <Text style={[styles.replyPreview, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                  {replyMsg.deleted_at ? 'This message was deleted' : (replyMsg.image_url ? 'Photo' : replyMsg.content)}
                </Text>
              </View>
            )}
            {isDeleted ? (
              <Text style={[styles.deletedText, { color: colors.onSurfaceVariant, fontStyle: 'italic' }]}>Message deleted</Text>
            ) : item.voice_url ? (
              <VoiceBubble uri={item.voice_url} duration={item.voice_duration} isMine={isMine} colors={colors} />
            ) : item.image_url ? (
              <TouchableOpacity onPress={() => setViewerUri(item.image_url)} activeOpacity={0.9}>
                <Image source={{ uri: item.image_url }} style={styles.msgImage} />
              </TouchableOpacity>
            ) : (
              <Text style={[styles.msgText, { color: isMine ? colors.onPrimaryContainer : colors.onSurface }]}>{item.content}</Text>
            )}
            <View style={styles.msgMeta}>
            {isEdited && !isDeleted && (
              <Text style={[styles.editedText, { color: colors.onSurfaceVariant }]}>edited</Text>
            )}
            <Text style={[styles.msgTime, { color: isMine ? colors.onPrimaryContainer : colors.onSurfaceVariant }, isMine && { opacity: 0.7 }]}>
              {formatClock(item.created_at)}
            </Text>
              {isMine && (
                <MaterialIcons
                  name={read ? 'done-all' : 'done'}
                  size={14}
                  color={read ? (isMine ? colors.primary : colors.secondary) : (isMine ? colors.onPrimaryContainer : colors.onSurfaceVariant)}
                />
              )}
            </View>
            {!!msgReactions && Object.keys(msgReactions).length > 0 && (
              <View style={styles.reactionRow}>
                {Object.entries(msgReactions).map(([emoji, r]) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionChip, { backgroundColor: r.mine ? colors.primaryContainer : colors.surfaceVariant }]}
                    onPress={() => toggleReaction(item, emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={[styles.reactionCount, { color: r.mine ? colors.primary : colors.onSurfaceVariant }]}>{r.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => restricted && onViewProfile && partnerId && onViewProfile(partnerId)}
          disabled={!restricted}
          activeOpacity={0.7}
        >
          {other?.avatar_url ? (
            <Image source={{ uri: other.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
              <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerName, { color: colors.onSurface }]} numberOfLines={1}>
            {other?.full_name || other?.username || 'User'}
          </Text>
          <Text style={[styles.headerSub, { color: otherTyping ? colors.primary : (otherIsOnline ? colors.secondary : colors.onSurfaceVariant) }]}>
            {otherTyping ? 'typing...' : (otherIsOnline ? 'Active now' : (other?.last_seen ? `Last seen ${formatClock(other.last_seen)}` : ''))}
          </Text>
        </View>
        {!restricted && (
          <>
            <TouchableOpacity style={styles.headerBtn} onPress={() => startCall('audio')}>
              <MaterialIcons name="call" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => startCall('video')}>
              <MaterialIcons name="videocam" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </>
        )}
        {restricted && onViewProfile && partnerId && (
          <TouchableOpacity style={styles.headerBtn} onPress={() => onViewProfile(partnerId)}>
            <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={i => String(i.id)}
          renderItem={renderMessage}
          contentContainerStyle={[styles.msgList, messages.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadEarlier} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {other?.full_name || 'Say'} hi 👋 Start the conversation!
              </Text>
            </View>
          }
        />
      )}

      {sendingImage && (
        <View style={styles.sendingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.sendingText, { color: colors.onSurfaceVariant }]}>Sending photo...</Text>
        </View>
      )}

      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={[styles.replyBarAccent, { backgroundColor: colors.primary }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.replyBarAuthor, { color: colors.primary }]}>
              {replyTo.sender_id === myId ? 'You' : (other?.full_name || 'User')}
            </Text>
            <Text style={[styles.replyBarText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {replyTo.image_url ? 'Photo' : replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: colors.surface }]}>
        {editing && (
          <View style={styles.editingBar}>
            <Text style={[styles.editingText, { color: colors.primary }]}>Editing message</Text>
            <TouchableOpacity onPress={() => { setEditing(null); setInput(''); }}>
              <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}
        {recording && (
          <View style={styles.recordingBar}>
            <View style={[styles.recDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.recordingText, { color: colors.onSurface }]}>Recording {recSeconds}s</Text>
            <TouchableOpacity style={[styles.recStopBtn, { backgroundColor: colors.error }]} onPress={stopRecording}>
              <MaterialIcons name="stop" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          {recording ? (
            <TouchableOpacity onPress={stopRecording} style={styles.iconBtn}>
              <MaterialIcons name="stop-circle" size={28} color={colors.error} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={startRecording} style={styles.iconBtn}>
              <MaterialIcons name="mic" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {!restricted && (
            <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
              <MaterialIcons name="image" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceContainerLow, color: colors.onSurface }]}
            placeholder="Message..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={!!actionMsg} transparent animationType="slide" onRequestClose={() => setActionMsg(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionMsg(null)}>
          <TouchableOpacity style={[styles.modalPanel, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setReplyTo(actionMsg); setActionMsg(null); }}>
              <MaterialIcons name="reply" size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowEmoji(actionMsg); setActionMsg(null); }}>
              <MaterialIcons name="emoji-emotions" size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>React</Text>
            </TouchableOpacity>
            {actionMsg?.sender_id === myId && !actionMsg?.deleted_at && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setEditing(actionMsg); setInput(actionMsg.content); setActionMsg(null); }}>
                  <MaterialIcons name="edit" size={22} color={colors.primary} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => deleteMessage(actionMsg)}>
                  <MaterialIcons name="delete-outline" size={22} color={colors.error} />
                  <Text style={[styles.menuItemText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
            {!restricted && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowReport(actionMsg); setActionMsg(null); }}>
                <MaterialIcons name="report-gmailerrorred" size={22} color={colors.onSurfaceVariant} />
                <Text style={styles.menuItemText}>Report</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!showEmoji} transparent animationType="slide" onRequestClose={() => setShowEmoji(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEmoji(null)}>
          <TouchableOpacity style={[styles.modalPanel, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
            <View style={styles.emojiGrid}>
              {EMOJI_GRID.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiCell, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={() => { toggleReaction(showEmoji, e); setShowEmoji(null); }}
                >
                  <Text style={styles.emojiCellText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.quickRow}>
              {QUICK_REACTS.map(e => (
                <TouchableOpacity key={e} style={styles.quickChip} onPress={() => { toggleReaction(showEmoji, e); setShowEmoji(null); }}>
                  <Text style={styles.quickText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!showReport} transparent animationType="slide" onRequestClose={() => setShowReport(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReport(null)}>
          <TouchableOpacity style={[styles.modalPanel, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Report message</Text>
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonRow, reportReason === r && { backgroundColor: colors.primaryContainer }]}
                onPress={() => setReportReason(r)}
              >
                <Text style={[styles.reasonText, { color: reportReason === r ? colors.onPrimaryContainer : colors.onSurface }]}>{r}</Text>
                {reportReason === r && <MaterialIcons name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, !reportReason && { opacity: 0.4 }]}
              onPress={() => doReport(showReport)}
              disabled={!reportReason}
            >
              <Text style={styles.submitBtnText}>Submit report</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {viewerUri && <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />}
        </View>
      </Modal>

      {sendingVoice && (
        <View style={styles.sendingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.sendingText, { color: colors.onSurfaceVariant }]}>Sending voice...</Text>
        </View>
      )}

      <Modal visible={!!callId} animationType="slide" onRequestClose={() => setCallId(null)}>
        <CallScreen
          callId={callId}
          other={other}
          type={callType}
          outbound
          onClose={() => setCallId(null)}
        />
      </Modal>
    </View>
  );
}

function VoiceBubble({ uri, duration, isMine, colors }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration : duration;
  const progress = total > 0 ? status.currentTime / total : 0;
  const bars = useMemo(() => {
    const seed = uri.length;
    return Array.from({ length: 20 }, (_, i) => 6 + ((seed * (i + 3)) % 14));
  }, [uri]);

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.currentTime >= total - 0.5 && total > 0) player.seekTo(0);
      player.play();
    }
  };

  const fmt = (s) => {
    const sec = Math.max(0, Math.round(s || 0));
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    return `${m}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  const active = isMine ? colors.primary : colors.secondary;
  const dim = isMine ? colors.onPrimaryContainer + '55' : colors.onSurfaceVariant + '55';

  return (
    <View style={styles.voiceWrap}>
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: active }]}
        onPress={toggle}
        activeOpacity={0.85}
      >
        <MaterialIcons name={status.playing ? 'pause' : 'play-arrow'} size={18} color="#fff" />
      </TouchableOpacity>
      <View style={styles.waveRow}>
        {bars.map((h, i) => {
          const on = progress > 0 && i / bars.length <= progress;
          return <View key={i} style={[styles.waveBar, { height: h, backgroundColor: on ? active : dim }]} />;
        })}
      </View>
      <Text style={[styles.voiceDuration, { color: isMine ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
        {fmt(status.currentTime > 0 ? total - status.currentTime : total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    paddingBottom: 10, paddingHorizontal: 8,
    height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
  },
  headerBtn: { padding: 6 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerName: { fontFamily: FONTS.headlineMd, fontSize: 16 },
  headerSub: { fontFamily: FONTS.labelMd, fontSize: 11, marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingHorizontal: 12, paddingVertical: 12 },
  emptyList: { flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center' },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  dayText: { fontFamily: FONTS.labelMd, fontSize: 11, opacity: 0.8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, marginBottom: 2 },
  avatarFallback: { width: 28, height: 28 },
  bubble: {
    maxWidth: '78%', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  msgText: { fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 20 },
  msgImage: {
    width: 200, height: 240, borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  voiceWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 180,
  },
  playBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  waveBar: { width: 3, borderRadius: 2, opacity: 0.9 },
  voiceDuration: { fontFamily: FONTS.labelMd, fontSize: 10, minWidth: 32, textAlign: 'right' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 3 },
  msgTime: { fontFamily: FONTS.labelMd, fontSize: 10 },
  editedText: { fontFamily: FONTS.labelMd, fontSize: 10, opacity: 0.7 },
  deletedText: { fontFamily: FONTS.bodyMd, fontSize: 14, fontStyle: 'italic' },
  replyBox: {
    borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 2,
    marginBottom: 6, borderRadius: 2,
  },
  replyAuthor: { fontFamily: FONTS.labelMd, fontSize: 11 },
  replyPreview: { fontFamily: FONTS.bodyMd, fontSize: 12, marginTop: 1 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontFamily: FONTS.labelMd, fontSize: 11 },
  loadMoreBtn: { alignSelf: 'center', paddingVertical: 10 },
  loadMoreText: { fontFamily: FONTS.labelMd, fontSize: 13 },
  sendingWrap: {
    position: 'absolute', top: 80, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sendingText: { fontFamily: FONTS.labelMd, fontSize: 12 },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  replyBarAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyBarAuthor: { fontFamily: FONTS.labelMd, fontSize: 12 },
  replyBarText: { fontFamily: FONTS.bodyMd, fontSize: 13 },
  inputBar: {
    paddingHorizontal: 10, paddingTop: 8,
    paddingBottom: isIos ? 22 : 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  editingBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 4, marginBottom: 6,
  },
  editingText: { fontFamily: FONTS.labelMd, fontSize: 12 },
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, paddingBottom: 8,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recordingText: { fontFamily: FONTS.bodyMd, fontSize: 13, flex: 1 },
  recStopBtn: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 10, maxHeight: 100,
    fontFamily: FONTS.bodyMd, fontSize: 14,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4 },
  menuItemText: { fontFamily: FONTS.bodyLg, fontSize: 15, color: '#E5E2E1' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiCell: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  emojiCellText: { fontSize: 24 },
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16 },
  quickChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  quickText: { fontSize: 18 },
  modalTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, marginBottom: 8 },
  reasonRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    marginVertical: 3,
  },
  reasonText: { fontFamily: FONTS.bodyLg, fontSize: 14 },
  submitBtn: {
    marginTop: 16, borderRadius: 14, paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { fontFamily: FONTS.headlineMd, fontSize: 15, color: '#fff' },
  viewerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute', top: 60, right: 20, zIndex: 2,
    padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerImage: { width: '100%', height: '80%' },
});
