import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Platform, StatusBar, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const PAGE_SIZE = 40;

const formatCount = (n) => {
  const count = Number(n || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const isSameDay = (a, b) => {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const dayLabel = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  if (isSameDay(d, now)) return 'TODAY';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return 'YESTERDAY';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
};

export default function CommunityChatScreen({ community, onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(community?.member_count || 0);
  const [myId, setMyId] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const listRef = useRef(null);
  const onlineCount = 0;

  const fetchMessages = useCallback(async (beforeCreatedAt) => {
    try {
      let query = supabase
        .from('community_messages')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).slice().reverse();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [community.id]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const rows = await fetchMessages();
    setMessages(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [fetchMessages]);

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);
      const { data: rows } = await supabase
        .from('community_members')
        .select('profiles(id, username, full_name, avatar_url)')
        .eq('community_id', community.id);
      setMembers((rows || []).map(r => r.profiles).filter(Boolean));
      const { data: countRow, count } = await supabase
        .from('community_members')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id);
      setMemberCount(count ?? memberCount);
    };
    boot();
    loadInitial();
  }, [community.id, loadInitial]);

  useEffect(() => {
    const channel = supabase
      .channel(`community-${community.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
        filter: `community_id=eq.${community.id}`,
      }, (payload) => {
        const m = payload.new;
        if (m.sender_id === myId) return;
        setMessages(prev => [...prev, m]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_messages',
        filter: `community_id=eq.${community.id}`,
      }, () => loadInitial())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [community.id, myId, loadInitial]);

  const loadEarlier = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const rows = await fetchMessages(oldest?.created_at);
    setMessages(prev => [...rows, ...prev]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending || !myId) return;
    setSending(true);
    const { data, error } = await supabase
      .from('community_messages')
      .insert({ community_id: community.id, sender_id: myId, content })
      .select()
      .single();
    setSending(false);
    if (error) return;
    setInput('');
    setMessages(prev => [...prev, data]);
  };

  const memberMap = useMemo(() => {
    const m = {};
    members.forEach(p => { m[p.id] = p; });
    return m;
  }, [members]);

  const renderMessage = ({ item, index }) => {
    const mine = item.sender_id === myId;
    const sender = memberMap[item.sender_id];
    const prev = index > 0 ? messages[index - 1] : null;
    const showHeader = !prev || prev.sender_id !== item.sender_id;
    const showDay = !prev || !isSameDay(prev.created_at, item.created_at);

    return (
      <View>
        {showDay && (
          <View style={styles.dayRow}>
            <Text style={[styles.dayText, { color: colors.onSurfaceVariant }]}>{dayLabel(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, mine && styles.messageRowMine]}>
          {!mine && (
            <View style={[styles.avatarWrap, { borderColor: colors.outlineVariant }]}>
              {sender?.avatar_url ? (
                <Image source={{ uri: sender.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
                </View>
              )}
            </View>
          )}
          <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
            {!mine && showHeader && (
              <Text style={[styles.senderName, { color: colors.primary }]}>
                {sender?.full_name || sender?.username || 'Member'}
              </Text>
            )}
            <View style={[styles.bubble, mine ? { backgroundColor: colors.surfaceVariant } : styles.bubbleOther, mine ? styles.bubbleMine : styles.bubbleOtherShape]}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.bubbleImg} resizeMode="cover" />
              ) : null}
              {!!item.content && (
                <Text style={[styles.bubbleText, { color: colors.onSurface }]}>{item.content}</Text>
              )}
            </View>
            <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.avatarWrap}>
          {community.image_url ? (
            <Image source={{ uri: community.image_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <MaterialIcons name="groups" size={18} color={colors.onSurfaceVariant} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{community.name}</Text>
          <Text style={[styles.headerMeta, { color: colors.onSurfaceVariant }]}>
            {formatCount(memberCount)} members{onlineCount > 0 ? ` · ${onlineCount} online` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <MaterialIcons name="info" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        onEndReached={loadEarlier}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No messages yet. Say hello!</Text>
          )
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.outlineVariant + '30' }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Send a message..."
            placeholderTextColor={colors.onSurfaceVariant + '80'}
            value={input}
            onChangeText={setInput}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={send}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          <MaterialIcons name="send" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 8,
      paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24),
      height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarWrap: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      justifyContent: 'center', alignItems: 'center',
    },
    avatar: { width: '100%', height: '100%' },
    avatarFallback: { backgroundColor: colors.surfaceVariant },
    headerTitle: { fontFamily: FONTS.labelLg, fontSize: 16, fontWeight: '700' },
    headerMeta: { fontFamily: FONTS.bodySm, fontSize: 12, marginTop: 2 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 12, paddingVertical: 12 },
    dayRow: { alignItems: 'center', marginVertical: 16 },
    dayText: {
      fontFamily: FONTS.labelMd, fontSize: 11, letterSpacing: 1,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
      backgroundColor: colors.surfaceContainer,
      overflow: 'hidden', textTransform: 'uppercase',
    },
    messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
    messageRowMine: { justifyContent: 'flex-end' },
    bubbleWrap: { maxWidth: '82%', alignItems: 'flex-start' },
    bubbleWrapMine: { alignItems: 'flex-end' },
    senderName: { fontFamily: FONTS.labelMd, fontSize: 12, marginBottom: 4, marginLeft: 12, opacity: 0.85 },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
    bubbleOther: { backgroundColor: colors.surfaceContainer },
    bubbleMine: { borderTopRightRadius: 4 },
    bubbleOtherShape: { borderTopLeftRadius: 4 },
    bubbleText: { fontFamily: FONTS.bodyMd, fontSize: 14, lineHeight: 20 },
    bubbleImg: { width: 220, height: 160, borderRadius: 10, marginBottom: 6 },
    timeText: { fontFamily: FONTS.labelMd, fontSize: 10, marginTop: 4, marginHorizontal: 4, opacity: 0.6 },
    emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center', marginTop: 60 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 12, paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
      borderTopWidth: 1,
    },
    inputWrap: { flex: 1, borderRadius: 24, paddingHorizontal: 6, justifyContent: 'center' },
    input: {
      fontFamily: FONTS.bodyMd, fontSize: 14,
      maxHeight: 100, paddingHorizontal: 12, paddingVertical: 10,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
