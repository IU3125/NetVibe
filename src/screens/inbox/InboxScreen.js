import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Image, StyleSheet, Platform, StatusBar, Modal, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const FILTERS = ['All', 'Unread', 'Pinned'];

const formatTime = (d) => {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function InboxScreen({ onViewConversation, onBack }) {
  const { colors } = useTheme();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [menuThread, setMenuThread] = useState(null);
  const debounceRef = useRef(null);

  const fetchThreads = useCallback(async (silent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mine } = await supabase
        .from('conversation_participants')
        .select('conversation_id, pinned, last_read_at, muted_until')
        .eq('user_id', user.id);

      if (!mine || mine.length === 0) {
        setThreads([]);
        return;
      }

      const convIds = mine.map(m => m.conversation_id);

      const { data: others } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', user.id);

      const otherMap = {};
      (others || []).forEach(o => { if (!otherMap[o.conversation_id]) otherMap[o.conversation_id] = o.user_id; });
      const otherUserIds = [...new Set(Object.values(otherMap))];

      let profMap = {};
      if (otherUserIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, is_online, last_seen')
          .in('id', otherUserIds);
        (profs || []).forEach(p => { profMap[p.id] = p; });
      }

      const { data: convs } = await supabase
        .from('conversations')
        .select('id, last_message_at')
        .in('id', convIds);
      const convMap = {};
      (convs || []).forEach(c => { convMap[c.id] = c; });

      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('conversation_id, content, image_url, sender_id, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(convIds.length * 3);

      const lastMap = {};
      (lastMsgs || []).forEach(m => {
        if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = m;
      });

      let unreadMap = {};
      const { data: unreadRows } = await supabase.rpc('get_unread_counts', { conv_ids: convIds });
      (unreadRows || []).forEach(u => { unreadMap[u.conversation_id] = u.unread_count; });

      const rows = mine.map(m => {
        const otherId = otherMap[m.conversation_id];
        const prof = otherId ? profMap[otherId] : null;
        const last = lastMap[m.conversation_id];
        const unreadCount = unreadMap[m.conversation_id] || 0;
        const lastSeen = prof?.last_seen ? new Date(prof.last_seen).getTime() : 0;
        const online = !!prof?.is_online || (lastSeen > 0 && Date.now() - lastSeen < 120000);
        const muted = !!(m.muted_until && new Date(m.muted_until).getTime() > Date.now());
        return {
          id: String(m.conversation_id),
          conversation_id: m.conversation_id,
          pinned: !!m.pinned,
          muted,
          unreadCount,
          unread: unreadCount > 0,
          online,
          name: prof?.full_name || prof?.username || 'User',
          avatar: prof?.avatar_url,
          snippet: last ? (last.image_url ? 'Photo' : (last.content || '')) : 'No messages yet',
          time: last ? formatTime(last.created_at) : '',
        };
      });

      rows.sort((a, b) => {
        const ta = convMap[a.conversation_id]?.last_message_at || '';
        const tb = convMap[b.conversation_id]?.last_message_at || '';
        return tb.localeCompare(ta);
      });

      setThreads(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchThreads(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchThreads(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, () => fetchThreads(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchThreads]);

  useEffect(() => {
    const interval = setInterval(() => fetchThreads(true), 30000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      supabase.from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {});
    };
    beat();
    const iv = setInterval(beat, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const searchUsers = useCallback(async (q) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSearching(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_online, last_seen')
        .neq('id', user.id)
        .limit(20);
      if (q.trim()) {
        query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
      }
      const { data } = await query;
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!showNew) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(userQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [userQuery, showNew, searchUsers]);

  const startConversation = async (other) => {
    try {
      const { data: convId, error } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: other.id });
      if (error) throw error;
      setShowNew(false);
      setUserQuery('');
      fetchThreads(true);
      onViewConversation && onViewConversation({ id: convId });
    } catch (err) {
      console.error(err);
    }
  };

  const togglePin = async (thread) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('conversation_participants')
      .update({ pinned: !thread.pinned })
      .eq('conversation_id', thread.conversation_id)
      .eq('user_id', user.id);
    setMenuThread(null);
    fetchThreads(true);
  };

  const toggleMute = async (thread) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    const mutedUntil = thread.muted ? null : new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    await supabase
      .from('conversation_participants')
      .update({ muted_until: mutedUntil })
      .eq('conversation_id', thread.conversation_id)
      .eq('user_id', user.id);
    setMenuThread(null);
    fetchThreads(true);
  };

  const markRead = async (thread) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', thread.conversation_id)
      .eq('user_id', user.id);
    setMenuThread(null);
    fetchThreads(true);
  };

  const deleteConversation = async (thread) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', thread.conversation_id)
      .eq('user_id', user.id);
    setMenuThread(null);
    fetchThreads(true);
  };

  const filtered = useMemo(() => {
    let data = threads;
    if (activeFilter === 'Unread') data = data.filter(th => th.unread);
    else if (activeFilter === 'Pinned') data = data.filter(th => th.pinned);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(th =>
        th.name.toLowerCase().includes(q) || th.snippet.toLowerCase().includes(q)
      );
    }
    return data;
  }, [threads, search, activeFilter]);

  const renderThread = ({ item }) => (
    <TouchableOpacity
      style={styles.thread}
      activeOpacity={0.7}
      onPress={() => onViewConversation && onViewConversation({ id: item.conversation_id })}
      onLongPress={() => setMenuThread(item)}
      delayLongPress={350}
    >
      <View style={styles.avatarCol}>
        {item.avatar ? (
          <View style={[styles.avatarWrap, item.unread && { borderColor: colors.primary }]}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          </View>
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.surfaceVariant }]}>
            <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
          </View>
        )}
        {item.online && <View style={[styles.onlineDot, { backgroundColor: colors.secondary }]} />}
      </View>
      <View style={styles.threadContent}>
        <View style={styles.threadTop}>
          <Text style={[styles.name, { color: colors.onSurface }, item.unread && { fontFamily: FONTS.headlineMd }]} numberOfLines={1}>
            {item.pinned && <MaterialIcons name="push-pin" size={13} color={colors.primary} />}
            {' '}{item.name}
          </Text>
          <View style={styles.timeWrap}>
            {item.muted && <MaterialIcons name="volume-off" size={13} color={colors.onSurfaceVariant} />}
            <Text style={[styles.time, item.unread && { color: colors.primary }]}>{item.time}</Text>
          </View>
        </View>
        <View style={styles.threadBottom}>
          <Text style={[styles.snippet, { color: colors.onSurfaceVariant }, item.unread && { color: colors.onSurface, fontFamily: FONTS.headlineMd }]} numberOfLines={1}>
            {item.snippet}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && (
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Inbox</Text>
          <View style={{ width: 40 }} />
        </View>
      )}
      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={colors.outline} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surfaceContainerLow, color: colors.onSurface }]}
          placeholder="Search conversations..."
          placeholderTextColor={colors.onSurfaceVariant}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f
                ? { backgroundColor: colors.primaryContainer }
                : { backgroundColor: colors.surfaceVariant },
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === f ? colors.onPrimaryContainer : colors.onSurfaceVariant },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderThread}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchThreads(); }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="chat-bubble-outline" size={48} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {threads.length === 0 ? 'No conversations yet. Start one with the button below!' : 'No results found'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primaryContainer }]} onPress={() => setShowNew(true)}>
        <MaterialIcons name="edit" size={24} color={colors.onPrimaryContainer} />
      </TouchableOpacity>

      <Modal visible={!!menuThread} transparent animationType="slide" onRequestClose={() => setMenuThread(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuThread(null)}>
          <TouchableOpacity
            style={[styles.modalPanel, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
            <View style={styles.menuHeader}>
              {menuThread?.avatar ? (
                <Image source={{ uri: menuThread.avatar }} style={styles.menuAvatar} />
              ) : (
                <View style={[styles.menuAvatar, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialIcons name="person" size={22} color={colors.onSurfaceVariant} />
                </View>
              )}
              <Text style={[styles.menuName, { color: colors.onSurface }]} numberOfLines={1}>{menuThread?.name}</Text>
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={() => togglePin(menuThread)}>
              <MaterialIcons name={menuThread?.pinned ? 'push-pin' : 'push-pin-outline'} size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>{menuThread?.pinned ? 'Unpin' : 'Pin'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => toggleMute(menuThread)}>
              <MaterialIcons name={menuThread?.muted ? 'volume-up' : 'volume-off'} size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>{menuThread?.muted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => markRead(menuThread)} disabled={!menuThread?.unread}>
              <MaterialIcons name="done-all" size={22} color={menuThread?.unread ? colors.primary : colors.onSurfaceVariant} />
              <Text style={[styles.menuItemText, !menuThread?.unread && { color: colors.onSurfaceVariant }]}>Mark as read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { marginTop: 4 }]} onPress={() => deleteConversation(menuThread)}>
              <MaterialIcons name="delete-outline" size={22} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Delete conversation</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNew(false)}>
          <TouchableOpacity
            style={[styles.modalPanel, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>New Conversation</Text>
            <View style={styles.modalSearchWrap}>
              <MaterialIcons name="search" size={20} color={colors.outline} style={styles.searchIcon} />
              <TextInput
                style={[styles.modalSearchInput, { backgroundColor: colors.surfaceContainerLow, color: colors.onSurface }]}
                placeholder="Search people..."
                placeholderTextColor={colors.onSurfaceVariant}
                value={userQuery}
                onChangeText={setUserQuery}
                autoFocus
              />
            </View>
            {searching ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={i => String(i.id)}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 320 }}
                contentContainerStyle={searchResults.length === 0 && styles.emptyList}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 24 }]}>
                    No users found
                  </Text>
                }
                renderItem={({ item }) => {
                  const lastSeen = item.last_seen ? new Date(item.last_seen).getTime() : 0;
                  const online = !!item.is_online || (lastSeen > 0 && Date.now() - lastSeen < 120000);
                  return (
                    <TouchableOpacity
                      style={styles.userRow}
                      activeOpacity={0.7}
                      onPress={() => startConversation(item)}
                    >
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.userAvatar} />
                      ) : (
                        <View style={[styles.userAvatar, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                          <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.userName, { color: colors.onSurface }]} numberOfLines={1}>
                          {item.full_name || item.username}
                        </Text>
                        <Text style={[styles.userSub, { color: online ? colors.secondary : colors.onSurfaceVariant }]}>
                          {online ? 'Active now' : '@' + item.username}
                        </Text>
                      </View>
                      <MaterialIcons name="chat-bubble-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    paddingBottom: 8, paddingHorizontal: 4,
    height: 56 + (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24),
  },
  backBtn: { padding: 8 },
  topBarTitle: { fontFamily: FONTS.headlineMd, fontSize: 18 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 12,
  },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    paddingLeft: 44, paddingRight: 16,
    fontFamily: FONTS.bodyMd, fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  filterText: { fontFamily: FONTS.labelMd, fontSize: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 96 },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontFamily: FONTS.bodyMd, fontSize: 14, textAlign: 'center' },
  thread: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 16,
  },
  avatarCol: { position: 'relative' },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 26,
    overflow: 'hidden', borderWidth: 2, borderColor: 'transparent',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#131313',
  },
  threadContent: { flex: 1, minWidth: 0 },
  threadTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 2,
  },
  name: { fontFamily: FONTS.bodyLg, fontSize: 15, flex: 1 },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  time: { fontFamily: FONTS.labelMd, fontSize: 11, color: '#C1C6D5' },
  threadBottom: { flexDirection: 'row', alignItems: 'center' },
  snippet: { fontFamily: FONTS.bodyMd, fontSize: 13, flex: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6, marginLeft: 8,
  },
  unreadBadgeText: { fontFamily: FONTS.labelMd, fontSize: 11, fontWeight: '700', color: '#fff' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    marginBottom: 12,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 12,
  },
  menuAvatar: { width: 44, height: 44, borderRadius: 22 },
  menuName: { fontFamily: FONTS.headlineMd, fontSize: 16, flex: 1 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  menuItemText: { fontFamily: FONTS.bodyLg, fontSize: 15, color: '#E5E2E1' },
  modalTitle: { fontFamily: FONTS.headlineMd, fontSize: 18, marginBottom: 12 },
  modalSearchWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalSearchInput: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    paddingLeft: 44, paddingRight: 16,
    fontFamily: FONTS.bodyMd, fontSize: 14,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontFamily: FONTS.bodyLg, fontSize: 15 },
  userSub: { fontFamily: FONTS.labelMd, fontSize: 12, marginTop: 1 },
});
