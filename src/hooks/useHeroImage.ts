import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

/** Pre-warm the cache for multiple keys with a single round-trip. */
export async function prefetchHeroImages(keys: string[]): Promise<void> {
  const missing = keys.filter((k) => !cache.has(k) && !inflight.has(k));
  if (missing.length === 0) return;

  const batch = supabase
    .from('admin_settings')
    .select('key,value')
    .in('key', missing)
    .then(({ data }: any) => {
      const map = new Map<string, string | null>();
      (data || []).forEach((row: { key: string; value: any }) => {
        const raw = row.value;
        map.set(row.key, raw ? String(raw).replace(/^"|"$/g, '') : null);
      });
      missing.forEach((k) => cache.set(k, map.get(k) ?? null));
      return null;
    })
    .catch(() => {
      missing.forEach((k) => cache.set(k, null));
      return null;
    })
    .finally(() => {
      missing.forEach((k) => inflight.delete(k));
    });

  missing.forEach((k) => inflight.set(k, batch as any));
  await batch;
}

export function useHeroImage(fallback: string, key: string = 'hero_showcase_image'): string {
  const cached = cache.get(key);
  const [url, setUrl] = useState<string>(cached || fallback);

  useEffect(() => {
    if (cache.has(key)) {
      const v = cache.get(key);
      if (v) setUrl(v);
      return;
    }

    const existingRequest = inflight.get(key);
    const request = existingRequest ?? supabase
        .from('admin_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle()
        .then(({ data }: any) => {
          const raw = data?.value;
          const val = raw ? String(raw).replace(/^"|"$/g, '') : null;
          cache.set(key, val);
          return val;
        })
        .catch(() => null)
        .finally(() => {
          if (!cache.get(key)) inflight.delete(key);
        });
    if (!existingRequest) {
      inflight.set(key, request);
    }

    request.then((val: string | null) => { if (val) setUrl(val); });
  }, [key, fallback]);

  return url;
}
