import { supabase } from '@/lib/supabase';

const DEFAULT_AUTH_TIMEOUT_MS = 4500;
const SUPABASE_AUTH_KEY_PREFIX = 'sb-';

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS, message = 'Request timed out'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getSessionWithTimeout(timeoutMs = DEFAULT_AUTH_TIMEOUT_MS) {
  try {
    return await withTimeout(
      supabase.auth.getSession(),
      timeoutMs,
      'Auth session lookup timed out',
    );
  } catch (error) {
    const fallbackSession = getStoredSessionFallback();
    if (fallbackSession) {
      void supabase.auth.refreshSession().catch(() => {});
      return { data: { session: fallbackSession }, error: null } as any;
    }
    throw error;
  }
}

function getStoredSessionFallback() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SUPABASE_AUTH_KEY_PREFIX) || !key.endsWith('-auth-token')) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession ?? parsed;
      if (session?.access_token && session?.refresh_token && session?.user?.id) {
        return session;
      }
    }
  } catch {}

  return null;
}