import { supabase } from './supabase';
import * as Sentry from '@sentry/react-native';

const IP_API = 'https://api.ipify.org?format=json';
const GEO_API = 'http://ip-api.com/json';

export async function trackLogin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    Sentry.setUser({ id: user.id, email: user.email || undefined });

    let ip = 'Unknown';
    try {
      const res = await fetch(IP_API, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      ip = data.ip || 'Unknown';
    } catch {}

    let city = '', country = '', isp = '';
    try {
      const geoRes = await fetch(`${GEO_API}/${ip}?fields=city,country,isp`, { signal: AbortSignal.timeout(3000) });
      const geoData = await geoRes.json();
      if (geoData.status !== 'fail') {
        city = geoData.city || '';
        country = geoData.country || '';
        isp = geoData.isp || '';
      }
    } catch {}

    await supabase.from('login_history').insert({
      user_id: user.id,
      ip_address: ip,
      city,
      country,
      isp,
    });

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('login_history')
      .delete()
      .eq('user_id', user.id)
      .lt('created_at', cutoff);
  } catch {}
}
