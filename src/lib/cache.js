// Tiny AsyncStorage-backed cache for offline-first screen data.
// Pattern: read instantly -> render; refresh in background; write through.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'nv_cache_';
const MAX_AGE = 24 * 60 * 60 * 1000; // 24h

export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
    const ts = parsed.ts || 0;
    return { data: parsed.data, ts, fresh: Date.now() - ts < MAX_AGE };
  } catch (e) {
    return null;
  }
}

export async function cacheSet(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    // storage full / unavailable — non-fatal
  }
}

export async function cacheRemove(key) {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch (e) {
    // ignore
  }
}
