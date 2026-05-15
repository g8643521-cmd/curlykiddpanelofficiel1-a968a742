// Shared connection status cache — avoids redundant RPC calls across pages
import { supabase } from '@/lib/supabase';

interface CachedResult {
  connected: boolean;
  latency: number | null;
  timestamp: number;
  data?: any;
}

const cache: Record<string, CachedResult> = {};
const CACHE_TTL = 60_000; // 60 seconds for fresh data
const STALE_TTL = 5 * 60_000; // 5 min — return stale instantly while revalidating

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Get cached value immediately (sync) — useful for instant first paint. */
export function getCached(key: string): CachedResult | null {
  const c = cache[key];
  if (!c) return null;
  if (Date.now() - c.timestamp > STALE_TTL) return null;
  return c;
}

export async function pingRpc(
  rpcName: string,
  args?: Record<string, unknown>
): Promise<{ connected: boolean; latency: number }> {
  const now = Date.now();
  const cached = cache[rpcName];

  if (cached && cached.connected && now - cached.timestamp < CACHE_TTL) {
    return { connected: true, latency: cached.latency! };
  }

  const start = performance.now();
  const { error } = args
    ? await supabase.rpc(rpcName, args)
    : await supabase.rpc(rpcName);
  const latency = Math.round(performance.now() - start);

  const result = { connected: !error, latency: error ? 0 : latency };
  cache[rpcName] = { ...result, latency: result.latency, timestamp: Date.now() };

  return result;
}

/**
 * Lightweight HEAD ping against a PostgREST table — avoids full RPC execution.
 * Typically 2-3x faster than pingRpc. Uses Range: 0-0 + Prefer: count=exact
 * to also return a row count cheaply.
 */
export async function pingHead(
  table: string,
  options: { bypassCache?: boolean } = {}
): Promise<{ connected: boolean; latency: number; count: number | null }> {
  const cacheKey = `head:${table}`;
  const now = Date.now();
  const cached = cache[cacheKey];

  if (!options.bypassCache && cached && cached.connected && now - cached.timestamp < CACHE_TTL) {
    return { connected: true, latency: cached.latency!, count: cached.data ?? null };
  }

  const start = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Range-Unit': 'items',
        Range: '0-0',
        Prefer: 'count=exact',
      },
    });
    const latency = Math.round(performance.now() - start);
    let count: number | null = null;
    const cr = res.headers.get('content-range'); // e.g. "0-0/123"
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) count = Number(m[1]);
    }
    const ok = res.status < 500;
    cache[cacheKey] = { connected: ok, latency, timestamp: Date.now(), data: count };
    return { connected: ok, latency, count };
  } catch {
    return { connected: false, latency: 0, count: null };
  }
}

export function invalidateCache(rpcName?: string) {
  if (rpcName) {
    delete cache[rpcName];
    delete cache[`head:${rpcName}`];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
