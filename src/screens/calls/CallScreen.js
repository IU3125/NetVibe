import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

export default function CallScreen({ callId, other, type, outbound, onClose }) {
  const { colors } = useTheme();
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCall = async () => {
      const { data } = await supabase.from('calls').select('*').eq('id', callId).single();
      if (!cancelled) setCall(data);
    };
    fetchCall();

    const channel = supabase
      .channel(`call-${callId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}`,
      }, (payload) => {
        if (!cancelled) setCall(payload.new);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [callId]);

  useEffect(() => {
    if (!call || call.status !== 'active') return;
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [call]);

  useEffect(() => {
    if (call && call.status !== 'ringing' && call.status !== 'active') {
      onClose && onClose();
    }
  }, [call, onClose]);

  const endCall = async () => {
    try {
      await supabase.from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callId);
    } catch (err) {
      console.error(err);
    }
    onClose && onClose();
  };

  const fmtTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const avatar = other?.avatar_url ? (
    <Image source={{ uri: other.avatar_url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
      <MaterialIcons name="person" size={64} color={colors.onSurfaceVariant} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={26} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
      <View style={styles.centerContent}>
        <View style={[styles.avatarRing, { borderColor: colors.primaryContainer }]}>
          {avatar}
        </View>
        <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
          {other?.full_name || other?.username || 'User'}
        </Text>
        <View style={styles.statusRow}>
          {call && call.status === 'ringing' && (
            <ActivityIndicator color={colors.primary} size="small" />
          )}
          <Text style={[styles.status, { color: call?.status === 'active' ? colors.secondary : colors.onSurfaceVariant }]}>
            {call?.status === 'ringing' ? 'Ringing...' : call?.status === 'active' ? fmtTime(elapsed) : 'Call ended'}
          </Text>
        </View>
        <Text style={[styles.type, { color: colors.onSurfaceVariant }]}>
          {type === 'video' ? 'Video call' : 'Voice call'}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => setMuted(!muted)}>
            <MaterialIcons name={muted ? 'mic-off' : 'mic'} size={24} color={muted ? colors.error : colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => setSpeaker(!speaker)}>
            <MaterialIcons name={speaker ? 'volume-up' : 'volume-off'} size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.endBtn, { backgroundColor: colors.error }]} onPress={endCall}>
          <MaterialIcons name="call-end" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24,
    paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  closeBtn: { padding: 8 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  avatarRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, padding: 4,
    marginBottom: 8,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 63 },
  name: { fontFamily: FONTS.headlineLg, fontSize: 26, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontFamily: FONTS.bodyLg, fontSize: 16 },
  type: { fontFamily: FONTS.labelMd, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  controls: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    alignItems: 'center', gap: 28,
  },
  controlRow: { flexDirection: 'row', gap: 24 },
  controlBtn: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  endBtn: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
});
