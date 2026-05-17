import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * When a stale/corrupted JWT is in localStorage we keep getting:
 *   403 "invalid claim: missing sub claim" / error_code: bad_jwt
 * from /auth/v1/user and from every PostgREST call (auth.uid() is null
 * → all RLS policies that depend on it fail silently).
 *
 * The only reliable recovery is to wipe the auth storage and force
 * the user to sign in again. We do this exactly once per session.
 */

let isRecovering = false;
let lastRefreshAttempt = 0;
const SUPABASE_AUTH_KEY_PREFIX = 'sb-';

export function isBadJwtError(err: unknown): boolean {
  if (!err) return false;
  const e = err as any;
  const code = e?.code || e?.error_code || e?.statusCode || e?.status;
  const msg = (e?.message || e?.error_description || e?.error || '').toString().toLowerCase();
  if (code === 403 || code === '403') {
    if (msg.includes('missing sub claim') || msg.includes('bad_jwt') || msg.includes('invalid claim')) return true;
  }
  if (msg.includes('missing sub claim') || msg.includes('bad_jwt')) return true;
  return false;
}

function clearAuthStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SUPABASE_AUTH_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
  try {
    sessionStorage.removeItem('ckp_roles_cache');
  } catch {}
}

export async function recoverFromBadJwt(reason = 'expired session'): Promise<void> {
  if (isRecovering) return;
  // Before nuking the session, try a token refresh first. Most "bad_jwt"
  // errors after long idle periods are just an expired access token that
  // needs to be exchanged using the still-valid refresh token.
  const now = Date.now();
  if (now - lastRefreshAttempt > 10_000) {
    lastRefreshAttempt = now;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session) {
        console.info('[authRecovery] Recovered via refreshSession (', reason, ')');
        return;
      }
    } catch {}
  }
  isRecovering = true;
  console.warn('[authRecovery] Forcing sign-out due to:', reason);
  try {
    toast.error('Your session expired. Signing you out…', { duration: 3500 });
  } catch {}
  try {
    await supabase.auth.signOut({ scope: 'local' } as any).catch(() => {});
  } catch {}
  clearAuthStorage();
  // Give the toast a moment, then hard-reload to a clean state.
  setTimeout(() => {
    try {
      window.location.replace('/login');
    } catch {
      window.location.href = '/login';
    }
  }, 600);
}

/**
 * Inspect any Supabase error and trigger recovery if it's a bad-JWT case.
 * Returns true when recovery was triggered (caller can short-circuit UI).
 */
export function handleSupabaseError(err: unknown): boolean {
  if (isBadJwtError(err)) {
    recoverFromBadJwt((err as any)?.message || 'bad_jwt');
    return true;
  }
  return false;
}

/**
 * Install a global guard:
 *  - watches for repeated bad_jwt errors via a window error listener
 *  - hooks supabase auth state changes for SIGNED_OUT
 */
export function installAuthRecovery() {
  // Catch any unhandled promise rejection that smells like bad_jwt.
  window.addEventListener('unhandledrejection', (ev) => {
    if (isBadJwtError(ev.reason)) {
      ev.preventDefault();
      recoverFromBadJwt('unhandledrejection');
    }
  });

  // NOTE: We deliberately do NOT proactively refresh the session on
  // visibilitychange. Supabase's auth client already has autoRefreshToken
  // enabled and handles expiry on its own. Calling refreshSession() on
  // every tab focus caused a TOKEN_REFRESHED storm that cascaded into
  // every onAuthStateChange listener (admin status, permissions, profile
  // guard, …) and made the whole UI flash into loading after tab switches.

  // Probe the session on boot; if /user returns 403 bad_jwt, recover.
  supabase.auth.getUser().then(({ error }) => {
    if (error && isBadJwtError(error)) {
      recoverFromBadJwt('boot probe');
    }
  }).catch((err) => {
    if (isBadJwtError(err)) recoverFromBadJwt('boot probe error');
  });
}
