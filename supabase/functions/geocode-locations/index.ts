import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Loc = { country_code?: string | null; postal_code?: string | null; city?: string | null };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USER_AGENT = 'MediKongGeocoder/1.0 (contact@medikong.pro)';

// Nominatim: 1 req/s. Cap per invocation to stay well under edge timeout.
const MAX_LOOKUPS_PER_CALL = 40;

function buildKey(l: Loc) {
  return `${l.country_code || 'UNK'}|${l.postal_code || '-'}|${l.city || '-'}`;
}
function buildQuery(l: Loc) {
  return [
    l.postal_code && l.postal_code !== '-' ? l.postal_code : null,
    l.city && l.city !== '-' ? l.city : null,
    l.country_code && l.country_code !== 'UNK' ? l.country_code : null,
  ].filter(Boolean).join(', ');
}

async function nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (Array.isArray(d) && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch (_) {}
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const locs: Loc[] = Array.isArray(body?.locations) ? body.locations : [];
    if (!locs.length) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Dedup by key
    const uniq = new Map<string, { key: string; query: string; loc: Loc }>();
    for (const l of locs) {
      const key = buildKey(l);
      if (!uniq.has(key)) uniq.set(key, { key, query: buildQuery(l), loc: l });
    }
    const items = [...uniq.values()].filter((x) => x.query);

    // Read cache
    const { data: cached } = await admin
      .from('geocode_cache')
      .select('cache_key, lat, lng')
      .in('cache_key', items.map((i) => i.key));

    const cacheMap = new Map<string, { lat: number; lng: number }>();
    for (const c of cached || []) {
      if (c.lat != null && c.lng != null) cacheMap.set(c.cache_key, { lat: c.lat as number, lng: c.lng as number });
    }

    // Bump hit_count/last_used_at for cache hits (fire and forget)
    if (cacheMap.size) {
      admin.from('geocode_cache')
        .update({ last_used_at: new Date().toISOString() })
        .in('cache_key', [...cacheMap.keys()])
        .then(() => {});
    }

    const missing = items.filter((i) => !cacheMap.has(i.key)).slice(0, MAX_LOOKUPS_PER_CALL);
    const remaining = items.filter((i) => !cacheMap.has(i.key)).length - missing.length;

    for (const m of missing) {
      const g = await nominatim(m.query);
      const row = {
        cache_key: m.key,
        country_code: m.loc.country_code ?? null,
        postal_code: m.loc.postal_code ?? null,
        city: m.loc.city ?? null,
        query: m.query,
        lat: g?.lat ?? null,
        lng: g?.lng ?? null,
        provider: 'nominatim',
        last_used_at: new Date().toISOString(),
      };
      await admin.from('geocode_cache').upsert(row, { onConflict: 'cache_key' });
      if (g) cacheMap.set(m.key, g);
      // Respect Nominatim 1 req/s
      await new Promise((r) => setTimeout(r, 1100));
    }

    const results = items
      .map((i) => {
        const g = cacheMap.get(i.key);
        return g ? { key: i.key, lat: g.lat, lng: g.lng } : null;
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({ results, resolved: results.length, pending: Math.max(0, remaining) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('geocode-locations error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
