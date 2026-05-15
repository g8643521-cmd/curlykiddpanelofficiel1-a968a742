import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getSessionWithTimeout } from '@/lib/authSession';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuthReady() {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setStatus('unauthenticated');
        return;
      }

      if (nextSession) {
        setSession(nextSession);
        setStatus('authenticated');
      }
    });

    getSessionWithTimeout()
      .then(({ data: { session: restoredSession } }) => {
        if (!isMounted) return;
        setSession(restoredSession ?? null);
        setStatus(restoredSession ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setStatus('unauthenticated');
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    status,
    isReady: status !== 'loading',
    isAuthenticated: status === 'authenticated',
  };
}
