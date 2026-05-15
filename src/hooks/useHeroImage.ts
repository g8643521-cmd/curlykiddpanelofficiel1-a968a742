import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

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
        .then(({ data }) => {
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

    request.then((val) => { if (val) setUrl(val); });
  }, [key, fallback]);

  return url;
}
