import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AccountStatusGuard from '@/components/AccountStatusGuard';
import { getSessionWithTimeout } from '@/lib/authSession';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

// Synchronously detect a stored Supabase session so we can skip the
// loading spinner when the user is already signed in. This avoids the
// "spinner restarts" flicker right after login.
const hasStoredSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes('access_token')) return true;
      }
    }
  } catch {}
  return false;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Optimistic initial state: if a token is in storage, render immediately
  // and verify in the background. Otherwise wait for the session check.
  const [status, setStatus] = useState<Status>(() =>
    hasStoredSession() ? 'authenticated' : 'loading'
  );

  useEffect(() => {
    let active = true;

    getSessionWithTimeout()
      .then(({ data: { session } }) => {
        if (!active) return;
        setStatus(session ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (active) setStatus((prev) => (prev === 'authenticated' ? 'authenticated' : 'unauthenticated'));
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setStatus('unauthenticated');
      } else if (session) {
        // Avoid redundant state updates that re-render the whole subtree.
        setStatus((prev) => (prev === 'authenticated' ? prev : 'authenticated'));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" style={{ willChange: 'transform' }} />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth" replace />;
  }

  return <AccountStatusGuard>{children}</AccountStatusGuard>;
};

export default ProtectedRoute;
