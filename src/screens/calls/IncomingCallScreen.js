import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

export default function IncomingCallScreen({ call, onAccept, onDecline }) {
  const { colors } = useTheme();
  const [caller, setCaller] = useState(call.caller || null);

  useEffect(() => {
    if (caller || !call.caller_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', call.caller_id)
        .single();
      if (!cancelled && data) setCaller(data);
    })();
    return () => { cancelled = true; };
  }, [call, caller]);

  useEffect(() => {
    const timer = setTimeout(() => onDecline('missed'), 30000);
    return () => clearTimeout(timer);
  }, [onDecline]);

  const avatar = caller?.avatar_url ? (
    <Image source={{ uri: caller.avatar_url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
      <MaterialIcons name="person" size={64} color={colors.onSurfaceVariant} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
      <View style={styles.centerContent}>
        <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
          {avatar}
        </View>
        <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
          {caller?.full_name || caller?.username || 'User'}
        </Text>
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.secondary} size="small" />
          <Text style={[styles.status, { color: colors.onSurfaceVariant }]}>
            {call.type === 'video' ? 'Incoming video call...' : 'Incoming voice call...'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={[styles.declineBtn, { backgroundColor: colors.error }]} onPress={() => onDecline('declined')}>
            <MaterialIcons name="call-end" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.secondary }]} onPress={() => onAccept()}>
            <MaterialIcons name={call.type === 'video' ? 'videocam' : 'call'} size={30} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Decline / Accept</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  controls: {
    paddingHorizontal: 24,
    paddingBottom: 64,
    alignItems: 'center', gap: 16,
  },
  controlRow: { flexDirection: 'row', gap: 40 },
  declineBtn: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  acceptBtn: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  hint: { fontFamily: FONTS.labelMd, fontSize: 12 },
});
