import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocale } from '../i18n/LocaleContext';

const DEFAULT_REGION = {
  latitude: 40.4093,
  longitude: 49.8671,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NetVibe/1.0 (location picker)' },
    });
    const data = await res.json();
    if (data && data.display_name) return data.display_name;
    return null;
  } catch (e) {
    return null;
  }
}

export default function LocationPickerModal({ visible, onClose, onSelect }) {
  const { t } = useLocale();
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [findingLocation, setFindingLocation] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setAddress(null);
    setLoading(false);
    setFindingLocation(true);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const r = {
            ...DEFAULT_REGION,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setRegion(r);
          await pick(r);
          return;
        }
      } catch (e) {
        // fall through to default region
      }
      await pick(DEFAULT_REGION);
    })();

    async function pick(r) {
      setFindingLocation(false);
      setRegion(r);
      setLoading(true);
      const name = await reverseGeocode(r.latitude, r.longitude);
      setAddress(name || `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`);
      setLoading(false);
    }
  }, [visible]);

  const handleRegionChange = async (r) => {
    setLoading(true);
    const name = await reverseGeocode(r.latitude, r.longitude);
    setAddress(name || `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`);
    setLoading(false);
  };

  const confirm = () => {
    if (!address) return;
    onSelect(address.trim());
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <MapView
        style={styles.map}
        region={region}
        loadingEnabled
        loadingIndicatorColor="#4F46E5"
        onRegionChangeComplete={handleRegionChange}
      >
        <Marker coordinate={region} />
      </MapView>

      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <MaterialIcons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>

        <View style={styles.hintWrap}>
          <MaterialIcons name="location-on" size={18} color="#E53935" />
          <Text style={styles.hintText}>{t('mapPickHint')}</Text>
        </View>

        <View style={styles.bottomCard}>
          <Text style={styles.addressLabel}>{t('selectedAddress')}</Text>
          <View style={styles.addressRow}>
            {findingLocation || loading ? (
              <ActivityIndicator size="small" />
            ) : (
              <MaterialIcons name="place" size={18} color="#666" />
            )}
            <Text style={styles.addressText} numberOfLines={2}>
              {findingLocation ? t('locatingAddress') : address || '—'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, (!address || loading || findingLocation) && styles.confirmDisabled]}
            onPress={confirm}
            disabled={!address || loading || findingLocation}
          >
            <Text style={styles.confirmText}>{t('confirmBtn')}</Text>
          </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: '#111',
  },
  map: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: { fontSize: 13, color: '#222', maxWidth: 280 },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  addressLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  addressText: { flex: 1, fontSize: 14, color: '#111' },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
