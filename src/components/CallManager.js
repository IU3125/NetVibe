import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import IncomingCallScreen from '../screens/calls/IncomingCallScreen';
import CallScreen from '../screens/calls/CallScreen';

export default function CallManager() {
  const [myId, setMyId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [activeCaller, setActiveCaller] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user) setMyId(user.id);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`incoming-calls:${myId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calls',
        filter: `callee_id=eq.${myId}`,
      }, (payload) => {
        if (payload.new.status === 'ringing') {
          setIncoming(payload.new);
          supabase.from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', payload.new.caller_id)
            .single()
            .then(({ data }) => {
              if (data) setActiveCaller(data);
            });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls',
        filter: `callee_id=eq.${myId}`,
      }, (payload) => {
        const c = payload.new;
        if (c.status === 'active' && incoming && incoming.id === c.id) {
          setIncoming(null);
          setActiveCall(c);
        } else if (['ended', 'declined', 'missed'].includes(c.status)) {
          setIncoming(null);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, incoming]);

  const handleAccept = async () => {
    if (!incoming) return;
    try {
      await supabase.from('calls')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', incoming.id);
      setActiveCall(incoming);
      setIncoming(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecline = async (status) => {
    if (!incoming) return;
    try {
      await supabase.from('calls')
        .update({ status, ended_at: new Date().toISOString() })
        .eq('id', incoming.id);
    } catch (err) {
      console.error(err);
    }
    setIncoming(null);
  };

  return (
    <>
      <Modal visible={!!incoming} transparent animationType="fade" onRequestClose={() => handleDecline('declined')}>
        {incoming && (
          <IncomingCallScreen
            call={incoming}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      </Modal>
      <Modal visible={!!activeCall} transparent animationType="fade" onRequestClose={() => setActiveCall(null)}>
        {activeCall && (
          <CallScreen
            callId={activeCall.id}
            type={activeCall.type}
            outbound={false}
            other={activeCaller}
            onClose={() => setActiveCall(null)}
          />
        )}
      </Modal>
    </>
  );
}
